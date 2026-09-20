#!/usr/bin/env node
/**
 * search-docs.mjs — 官方文档检索（SQLite 全文索引）
 *
 * 查询 references/huawei-docs.db（由 build-doc-index.mjs 构建）。
 * 毫秒级响应，无需遍历数万个 Markdown 文件。
 *
 * 用法：
 *   node scripts/search-docs.mjs "沉浸光感"                        # 全文检索
 *   node scripts/search-docs.mjs "材质档位" --catalog harmonyos-guides
 *   node scripts/search-docs.mjs "圆角" "间距"                      # 多词 AND
 *   node scripts/search-docs.mjs "材质" --any                      # 任一词命中（OR）
 *   node scripts/search-docs.mjs "ImmersiveStyle" --limit 30 --context 3
 *   node scripts/search-docs.mjs "光感" --title-only               # 只搜标题
 *   node scripts/search-docs.mjs --read harmonyos-guides/arkts-immersive-light-sense-overview
 *   node scripts/search-docs.mjs --stats                           # 知识库统计
 *   node scripts/search-docs.mjs --catalogs                        # 列出板块
 *   node scripts/search-docs.mjs "材质" --json                     # 机器可读
 */
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';

/**
 * 正文在库中以 gzip BLOB 存储以压缩体积。
 * 兼容 TEXT 存储（早期版本建的库），避免强制重建。
 */
function readBody(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return gunzipSync(value).toString('utf8');
  } catch {
    return Buffer.from(value).toString('utf8');
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(HERE, '..');
const DB_PATH = join(SKILL_ROOT, 'references', 'huawei-docs.db');

// ───────────────────────── CLI ─────────────────────────
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const optVal = (n, d = '') => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const VALUE_FLAGS = new Set(['--catalog', '--limit', '--context', '--read', '--out']);
const keywords = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { if (VALUE_FLAGS.has(a)) i++; continue; }
  if (i > 0 && VALUE_FLAGS.has(argv[i - 1])) continue;
  keywords.push(a);
}

const OPT = {
  catalog: optVal('--catalog'),
  limit: parseInt(optVal('--limit', '20'), 10),
  context: parseInt(optVal('--context', '2'), 10),
  read: optVal('--read'),
  any: flags.has('--any'),
  titleOnly: flags.has('--title-only'),
  json: flags.has('--json'),
  stats: flags.has('--stats'),
  catalogs: flags.has('--catalogs'),
};

// ───────────────────── 分词（与建索引共用同一模块）─────────────────────
import { buildMatch, tokenizeList } from './lib/tokenize.mjs';

// ───────────────────── 片段生成 ─────────────────────
/** 在正文里定位关键词，生成带上下文的片段 */
function makeSnippets(body, kws, maxSnippets = 2) {
  if (!body) return [];
  const lines = body.split('\n');
  const found = [];
  const lower = kws.map((k) => k.toLowerCase());
  for (let i = 0; i < lines.length && found.length < maxSnippets; i++) {
    const low = lines[i].toLowerCase();
    if (lower.some((k) => low.includes(k))) {
      const from = Math.max(0, i - OPT.context);
      const to = Math.min(lines.length, i + OPT.context + 1);
      const block = [];
      for (let j = from; j < to; j++) {
        const mark = lower.some((k) => lines[j].toLowerCase().includes(k)) ? '>' : ' ';
        block.push(`      ${mark} ${lines[j].trim().slice(0, 150)}`);
      }
      found.push(block.join('\n'));
      i = to - 1;
    }
  }
  return found;
}

// ───────────────────── 输出 ─────────────────────
const fmtSize = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

function openDb() {
  if (!existsSync(DB_PATH)) {
    console.error(`未找到索引数据库：${DB_PATH}`);
    console.error('');
    console.error('请先构建：');
    console.error('  node scripts/sync-huawei-docs.mjs      # 同步官方文档（约 10 分钟）');
    console.error('  node scripts/build-doc-index.mjs       # 构建 SQLite 索引');
    process.exit(1);
  }
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

// ───────────────────── 主流程 ─────────────────────
function main() {
  const db = openDb();

  // 统计
  if (OPT.stats) {
    const meta = Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map((r) => [r.key, r.value]));
    const cats = db.prepare('SELECT catalog, COUNT(*) n FROM docs GROUP BY catalog ORDER BY n DESC').all();
    const size = statSync(DB_PATH).size;
    if (OPT.json) {
      console.log(JSON.stringify({ db: DB_PATH, size, meta, catalogs: cats }, null, 2));
      return;
    }
    console.log(`知识库：${DB_PATH}`);
    console.log(`大小：${fmtSize(size)}`);
    console.log(`文档：${meta.docCount || '?'} 篇，${cats.length} 个板块`);
    console.log(`构建：${meta.builtAt || '?'}`);
    console.log(`分词：${meta.tokenizer || '?'}；正文采样 ${meta.sampleChars || '?'} 字符`);
    console.log(`源 Markdown：${meta.sourceBytes ? fmtSize(Number(meta.sourceBytes)) : '?'}`);
    return;
  }

  // 板块列表
  if (OPT.catalogs) {
    const cats = db.prepare('SELECT catalog, COUNT(*) n FROM docs GROUP BY catalog ORDER BY n DESC').all();
    if (OPT.json) { console.log(JSON.stringify(cats, null, 2)); return; }
    console.log(`文档板块（共 ${cats.reduce((a, c) => a + c.n, 0)} 篇）：\n`);
    cats.forEach((c) => console.log(`  ${String(c.n).padStart(6)}  ${c.catalog}`));
    console.log('\n用 --catalog <板块名> 限定检索范围。');
    return;
  }

  // 读取全文
  if (OPT.read) {
    const [cat, ...rest] = OPT.read.split('/');
    const oid = rest.join('/');
    const row = db.prepare('SELECT * FROM docs WHERE catalog = ? AND object_id = ?').get(cat, oid);
    if (!row) {
      console.error(`未找到：${OPT.read}`);
      console.error('提示：用 --catalogs 查看板块名，或先检索确认 objectId。');
      process.exit(1);
    }
    if (OPT.json) { console.log(JSON.stringify({ ...row, body: readBody(row.body) }, null, 2)); return; }
    console.log(`# ${row.title}`);
    console.log(`> 板块：${row.catalog}  |  objectId：${row.object_id}`);
    console.log(`> 来源：${row.source_url}`);
    console.log(`> 更新：${row.updated_date}  |  图片：${row.image_count} 张`);
    console.log('');
    if (row.toc) { console.log('## 本文目录\n'); console.log(row.toc); console.log(''); }
    console.log(readBody(row.body));
    if (row.images) { console.log('\n' + row.images); }
    return;
  }

  // 检索
  if (keywords.length === 0) {
    console.error('用法：node scripts/search-docs.mjs <关键词...> [选项]');
    console.error('      node scripts/search-docs.mjs --stats | --catalogs | --read <catalog>/<objectId>');
    process.exit(1);
  }

  const match = buildMatch(keywords, OPT.any);
  if (!match) { console.error('关键词无法分词。'); process.exit(1); }

  const catalogFilter = OPT.catalog ? ' AND d.catalog = ?' : '';
  const params = OPT.catalog ? [match, OPT.catalog] : [match];

  // 第一步：只查元数据 + 评分（不读 body，避免把命中的长正文全读进来）
  const metaSql = `
    SELECT d.id, d.catalog, d.object_id, d.title, d.source_url, d.updated_date,
           d.image_count,
           bm25(docs_fts) AS score
    FROM docs_fts f
    JOIN docs d ON d.id = f.rowid
    WHERE docs_fts MATCH ?${catalogFilter}
    ORDER BY score
    LIMIT ?`;
  const rows = db.prepare(metaSql).all(...params, OPT.limit * 5);

  // 标题加权重排：标题命中优先，其次按 bm25
  const kwsLower = keywords.map((k) => k.toLowerCase());
  const scored = rows.map((r) => {
    const titleLow = (r.title || '').toLowerCase();
    const titleHits = kwsLower.filter((k) => titleLow.includes(k)).length;
    return { ...r, titleHits, sortKey: (titleHits > 0 ? -1000 : 0) + r.score };
  }).sort((a, b) => a.sortKey - b.sortKey);

  const shown = scored.slice(0, OPT.limit);

  // 第二步：只对将要展示的条目读正文，用于生成片段
  if (shown.length > 0 && !OPT.json) {
    const bodyStmt = db.prepare('SELECT body FROM docs WHERE id = ?');
    for (const r of shown) {
      const row = bodyStmt.get(r.id);
      r.body = row ? readBody(row.body) : '';
    }
  }

  if (OPT.json) {
    console.log(JSON.stringify({
      keywords, catalog: OPT.catalog || null, match, totalHits: rows.length,
      results: shown.map((r) => ({
        catalog: r.catalog, objectId: r.object_id, title: r.title,
        sourceUrl: r.source_url, updatedDate: r.updated_date,
        imageCount: r.image_count, titleHit: r.titleHits > 0,
      })),
    }, null, 2));
    return;
  }

  if (shown.length === 0) {
    console.log(`未找到匹配「${keywords.join(' + ')}」的文档。`);
    console.log('建议：换更短的关键词；去掉 --catalog 限定；或加 --any 放宽为 OR 匹配。');
    return;
  }

  console.log(`关键词：${keywords.join(OPT.any ? ' | ' : ' + ')}${OPT.catalog ? `  （板块：${OPT.catalog}）` : ''}`);
  console.log(`命中 ${rows.length} 篇，显示前 ${shown.length} 篇\n`);

  shown.forEach((r, i) => {
    const flag = r.titleHits > 0 ? ' ★' : '';
    console.log(`${String(i + 1).padStart(3)}. ${r.title}${flag}`);
    console.log(`     ${r.catalog}/${r.object_id}`);
    console.log(`     更新 ${r.updated_date || '?'}${r.image_count ? `  ·  ${r.image_count} 张图` : ''}`);
    const snips = makeSnippets(r.body, keywords);
    snips.forEach((s) => console.log(s));
    console.log('');
  });

  console.log(`读取全文：node scripts/search-docs.mjs --read ${shown[0].catalog}/${shown[0].object_id}`);
  console.log('★ = 标题命中');
}

try { main(); } catch (e) { console.error('检索失败：', e.message); process.exit(1); }
