#!/usr/bin/env node
/**
 * build-doc-index.mjs — 把已同步的 Markdown 文档构建成单个 SQLite 数据库
 *
 * 为什么要索引：
 *   4 万+ 个 Markdown 文件直接进 Git 会严重碎片化（每个文件一个 blob+tree entry，
 *   clone 极慢）。构建成单个 .db 文件后可交给 Git LFS 管理，且查询快得多。
 *
 * 设计要点：
 *   - 零第三方依赖，只用 Node 22+ 内置的 node:sqlite
 *   - FTS5 全文索引，中文用 **bigram 预分词**（trigram 不支持 2 字查询，
 *     unicode61 不切中文，实测只有 bigram 方案对中英文都可靠）
 *   - 索引 title + 目录 + 正文采样（去代码块），完整正文存主表 ——
 *     与官方 DevEco CLI 的 bodySample 思路一致，避免索引膨胀
 *
 * 用法：
 *   node scripts/build-doc-index.mjs                    # 构建/重建
 *   node scripts/build-doc-index.mjs --out docs.db      # 指定输出
 *   node scripts/build-doc-index.mjs --sample 2000      # 采样字符数
 *   node scripts/build-doc-index.mjs --keep-md          # 保留中间 Markdown（默认保留）
 */
import { readdir, readFile, stat, unlink, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import { tokenize } from './lib/tokenize.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(HERE, '..');
const DOCS_ROOT = join(SKILL_ROOT, 'references', 'huawei-docs');

// ───────────────────────── CLI ─────────────────────────
const argv = process.argv.slice(2);
const optVal = (n, d = '') => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = optVal('--out', join(SKILL_ROOT, 'references', 'huawei-docs.db'));
const SAMPLE_CHARS = parseInt(optVal('--sample', '1500'), 10);
const META_ONLY = argv.includes('--meta-only');
const BATCH = 500;

// ───────────────────── 索引辅助 ─────────────────────
/** 去掉代码块、图片、链接语法，留下适合建索引的纯文本 */
function plainForIndex(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[>|*-]\s*/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ───────────────────── 解析 Markdown ─────────────────────
/**
 * frontmatter 用驼峰命名（updatedDate / sourceUrl / …），
 * 数据库列用下划线命名，这里做显式映射。
 */
const FRONTMATTER_KEYS = {
  title: 'title',
  objectId: 'object_id',
  catalogName: 'catalog',
  sourceUrl: 'source_url',
  updatedDate: 'updated_date',
  versionLabels: 'version_labels',
  imageCount: 'image_count',
};

function parseFrontmatter(md) {
  const out = {};
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const col = FRONTMATTER_KEYS[kv[1]];
    if (!col) continue;
    const raw = kv[2].trim();
    // 字符串可能被双引号包裹（title 常含特殊字符）；数组/对象保持原样
    out[col] = raw.startsWith('[') || raw.startsWith('{')
      ? raw
      : raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
  return out;
}

function parseDoc(md, relPath) {
  const fm = {
    object_id: '', catalog: '', title: '', source_url: '',
    updated_date: '', version_labels: '', image_count: 0,
  };
  Object.assign(fm, parseFrontmatter(md));

  // 兜底：从路径推断
  const parts = relPath.replace(/\\/g, '/').split('/');
  if (!fm.catalog) fm.catalog = parts[0] || '';
  if (!fm.object_id) fm.object_id = (parts[parts.length - 1] || '').replace(/\.md$/, '');
  fm.image_count = parseInt(String(fm.image_count), 10) || 0;

  // 兜底：frontmatter 缺 updated_date 时，从正文的 "> 更新时间：" 提取
  if (!fm.updated_date) {
    const um = /^>\s*更新时间：\s*(.+)$/m.exec(md);
    if (um) fm.updated_date = um[1].trim();
  }

  // 目录：取 "## 本文目录" 到下一个二级标题之间的行
  const tocMatch = /##\s*本文目录\n([\s\S]*?)(?=\n##\s)/.exec(md);
  const toc = tocMatch
    ? tocMatch[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('-')).join('\n')
    : '';

  // 正文：从 "## 正文" 起
  const bodyIdx = md.indexOf('## 正文');
  const body = bodyIdx >= 0 ? md.slice(bodyIdx + '## 正文'.length).trim() : md;

  // 图片清单：从 "## 图片清单" 起
  const imgIdx = body.indexOf('## 图片清单');
  const images = imgIdx >= 0 ? body.slice(imgIdx).trim() : '';

  return { ...fm, toc, body, images };
}

// ───────────────────── 遍历 ─────────────────────
async function walk(dir, out = [], depth = 0) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (depth < 3) await walk(p, out, depth + 1); }
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// ───────────────────── 主流程 ─────────────────────
async function main() {
  if (!existsSync(DOCS_ROOT)) {
    console.error(`未找到文档目录：${DOCS_ROOT}`);
    console.error('请先运行：node scripts/sync-huawei-docs.mjs');
    process.exit(1);
  }

  console.log('构建文档索引');
  console.log('─'.repeat(62));
  process.stdout.write('扫描 Markdown … ');
  const files = await walk(DOCS_ROOT);
  console.log(`${files.length} 篇`);

  if (files.length === 0) { console.error('没有可索引的文档。'); process.exit(1); }

  // ── 仅更新元数据（不重建 FTS，秒级）──
  // 用于修复 frontmatter 字段映射等元数据问题，避免重新索引全文。
  if (META_ONLY) {
    if (!existsSync(OUT)) {
      console.error(`--meta-only 需要已存在的数据库：${OUT}`);
      console.error('先运行不带该参数的完整构建。');
      process.exit(1);
    }
    const db = new DatabaseSync(OUT);
    const upd = db.prepare(`UPDATE docs SET title=?, source_url=?, updated_date=?,
      version_labels=?, image_count=?, toc=? WHERE catalog=? AND object_id=?`);
    let n = 0;
    db.exec('BEGIN');
    for (const f of files) {
      try {
        const md = await readFile(f, 'utf8');
        const d = parseDoc(md, relative(DOCS_ROOT, f));
        upd.run(d.title, d.source_url, d.updated_date, d.version_labels,
                d.image_count, d.toc, d.catalog, d.object_id);
        n++;
      } catch { /* 跳过 */ }
    }
    db.exec('COMMIT');
    const insMeta = db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)');
    insMeta.run('metaUpdatedAt', new Date().toISOString());
    db.close();
    console.log(`已更新 ${n} 篇的元数据：${OUT}`);
    return;
  }

  // 重建：写入临时文件，成功后原子替换 ——
  // 构建期间旧索引始终可用，中断也不会留下半成品。
  const TMP = OUT + '.building';
  if (existsSync(TMP)) await unlink(TMP);
  const db = new DatabaseSync(TMP);

  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    PRAGMA temp_store = MEMORY;
    PRAGMA cache_size = -64000;

    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);

    CREATE TABLE docs (
      id             INTEGER PRIMARY KEY,
      object_id      TEXT NOT NULL,
      catalog        TEXT NOT NULL,
      title          TEXT,
      source_url     TEXT,
      updated_date   TEXT,
      version_labels TEXT,
      image_count    INTEGER DEFAULT 0,
      toc            TEXT,
      body           BLOB,     -- gzip 压缩的 Markdown 正文
      images         TEXT
    );
    CREATE UNIQUE INDEX idx_docs_key ON docs(catalog, object_id);
    CREATE INDEX idx_docs_catalog ON docs(catalog);

    CREATE VIRTUAL TABLE docs_fts USING fts5(
      tokens,
      content='',
      tokenize='unicode61'
    );
  `);

  const insDoc = db.prepare(`INSERT INTO docs
    (object_id, catalog, title, source_url, updated_date, version_labels, image_count, toc, body, images)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insFts = db.prepare('INSERT INTO docs_fts(rowid, tokens) VALUES (?, ?)');
  const insMeta = db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)');

  let done = 0, bytes = 0, skipped = 0;
  let batch = [];
  const t0 = Date.now();

  const flush = () => {
    if (batch.length === 0) return;
    db.exec('BEGIN');
    for (const b of batch) { insDoc.run(...b.doc); insFts.run(b.rowid, b.tokens); }
    db.exec('COMMIT');
    batch = [];
  };

  for (const f of files) {
    try {
      const md = await readFile(f, 'utf8');
      const rel = relative(DOCS_ROOT, f);
      const d = parseDoc(md, rel);
      const rowid = done + 1;

      // 索引内容 = 标题 + 目录 + 正文采样（去代码块）
      const sample = plainForIndex(d.body).slice(0, SAMPLE_CHARS);
      const tokens = tokenize([d.title, d.toc, sample, d.object_id, d.catalog].join(' \n '));

      batch.push({
        rowid,
        doc: [d.object_id, d.catalog, d.title, d.source_url, d.updated_date,
              d.version_labels, d.image_count, d.toc,
              gzipSync(Buffer.from(d.body, 'utf8')), d.images],
        tokens,
      });
      bytes += Buffer.byteLength(md, 'utf8');
      done++;
      if (batch.length >= BATCH) {
        flush();
        const el = (Date.now() - t0) / 1000;
        process.stdout.write(`\r  已索引 ${done}/${files.length}  (${(done / el).toFixed(0)} 篇/s)   `);
      }
    } catch { skipped++; }
  }
  flush();

  insMeta.run('builtAt', new Date().toISOString());
  insMeta.run('docCount', String(done));
  insMeta.run('sourceBytes', String(bytes));
  insMeta.run('sampleChars', String(SAMPLE_CHARS));
  insMeta.run('tokenizer', 'bigram-zh + word-en');
  insMeta.run('bodyEncoding', 'gzip');

  db.exec('INSERT INTO docs_fts(docs_fts) VALUES (\'optimize\')');
  db.exec('VACUUM');
  db.close();

  // 原子替换：新库就绪后才顶替旧库
  if (existsSync(OUT)) await unlink(OUT);
  await rename(TMP, OUT);

  const st = await stat(OUT);
  const el = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n\n${'─'.repeat(62)}`);
  console.log(`已索引 ${done} 篇${skipped ? `（跳过 ${skipped}）` : ''}  用时 ${el}s`);
  console.log(`源 Markdown：${(bytes / 1048576).toFixed(1)} MB`);
  console.log(`数据库：${OUT}`);
  console.log(`         ${(st.size / 1048576).toFixed(1)} MB  (${(st.size / bytes * 100).toFixed(0)}% of 源，正文 gzip 压缩)`);
  console.log(`\n查询：node scripts/search-docs.mjs "关键词"`);
}

main().catch((e) => { console.error('\n构建失败：', e); process.exit(1); });
