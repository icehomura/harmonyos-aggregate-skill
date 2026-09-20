#!/usr/bin/env node
/**
 * build-skill-index.mjs — 把已同步的官方 Skill 构建成 SQLite 数据库
 *
 * 与文档索引同理：237 个 Skill 目录合计 1.4 GB（含大量二进制资源），
 * 但**文本内容只有约 2 MB**。抽取文本入库后，整包可直接随仓库分发，
 * 且查询是毫秒级。
 *
 * 用法：
 *   node scripts/build-skill-index.mjs
 *   node scripts/build-skill-index.mjs --out references/huawei-skills.db
 *   node scripts/build-skill-index.mjs --sample 4000    # 每个文件的索引采样字符数
 *
 * 前置：node scripts/sync-huawei-skills.mjs --download --tag <分类>
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
const SKILLS_ROOT = join(SKILL_ROOT, 'references', 'huawei-skills');

const argv = process.argv.slice(2);
const optVal = (n, d = '') => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = optVal('--out', join(SKILL_ROOT, 'references', 'huawei-skills.db'));
const SAMPLE_CHARS = parseInt(optVal('--sample', '3000'), 10);

/** 索引用的纯文本化：去代码块与 Markdown 语法 */
function plainForIndex(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*`_>|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 解析 SKILL.md 的 YAML frontmatter（只取需要的字段） */
function parseSkillFrontmatter(md) {
  const out = { name: '', description: '' };
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return out;
  const body = m[1];
  // description 常为多行折叠标量（> 或 |），需单独处理
  const nameM = /^name:\s*(.+)$/m.exec(body);
  if (nameM) out.name = nameM[1].trim().replace(/^["']|["']$/g, '');
  const descM = /^description:\s*([\s\S]*?)(?=\n[a-zA-Z_]+:|\s*$)/m.exec(body);
  if (descM) {
    out.description = descM[1]
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^[>|]\s*/, ''))
      .filter(Boolean)
      .join(' ')
      .replace(/^["']|["']$/g, '')
      .trim();
  }
  return out;
}

/** 递归收集目录下的 .md 文件 */
async function collectMarkdown(dir, base = dir, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await collectMarkdown(p, base, out);
    else if (e.name.endsWith('.md')) out.push({ abs: p, rel: relative(base, p).replace(/\\/g, '/') });
  }
  return out;
}

async function main() {
  if (!existsSync(SKILLS_ROOT)) {
    console.error(`未找到 Skill 目录：${SKILLS_ROOT}`);
    console.error('请先同步：node scripts/sync-huawei-skills.mjs --download --tag HMOS');
    process.exit(1);
  }

  console.log('构建 Skill 索引');
  console.log('─'.repeat(62));

  const dirs = (await readdir(SKILLS_ROOT, { withFileTypes: true }))
    .filter((e) => e.isDirectory()).map((e) => e.name);
  console.log(`发现 ${dirs.length} 个 Skill 目录\n`);

  const TMP = OUT + '.building';
  if (existsSync(TMP)) await unlink(TMP);
  const db = new DatabaseSync(TMP);
  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;

    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);

    CREATE TABLE skills (
      id          INTEGER PRIMARY KEY,
      name        TEXT UNIQUE NOT NULL,
      title       TEXT,
      description TEXT,
      tags        TEXT,
      owner       TEXT,
      file_count  INTEGER DEFAULT 0,
      text_bytes  INTEGER DEFAULT 0,
      synced_at   TEXT
    );

    CREATE TABLE files (
      id       INTEGER PRIMARY KEY,
      skill_id INTEGER NOT NULL,
      path     TEXT NOT NULL,
      content  BLOB              -- gzip 压缩
    );
    CREATE INDEX idx_files_skill ON files(skill_id);

    CREATE VIRTUAL TABLE skills_fts USING fts5(tokens, content='', tokenize='unicode61');
  `);

  const insSkill = db.prepare(`INSERT INTO skills
    (name, title, description, tags, owner, file_count, text_bytes, synced_at)
    VALUES (?,?,?,?,?,?,?,?)`);
  const insFile = db.prepare('INSERT INTO files(skill_id, path, content) VALUES (?,?,?)');
  const insFts = db.prepare('INSERT INTO skills_fts(rowid, tokens) VALUES (?, ?)');

  let done = 0, skipped = 0, totalBytes = 0, totalFiles = 0;
  const t0 = Date.now();

  for (const name of dirs) {
    const dir = join(SKILLS_ROOT, name);
    try {
      const mdFiles = await collectMarkdown(dir);
      const skillMd = mdFiles.find((f) => f.rel === 'SKILL.md');
      if (!skillMd) { skipped++; continue; }

      const skillText = await readFile(skillMd.abs, 'utf8');
      const fm = parseSkillFrontmatter(skillText);

      // .sync.json 是同步脚本写入的元数据
      let meta = {};
      const marker = join(dir, '.sync.json');
      if (existsSync(marker)) {
        try { meta = JSON.parse(await readFile(marker, 'utf8')); } catch { /* 忽略 */ }
      }

      const skillId = done + 1;
      let textBytes = 0;
      const indexParts = [fm.name, fm.description, name, (meta.tags || []).join(' ')];

      for (const f of mdFiles) {
        const content = f.abs === skillMd.abs ? skillText : await readFile(f.abs, 'utf8');
        const buf = Buffer.from(content, 'utf8');
        textBytes += buf.length;
        totalFiles++;
        insFile.run(skillId, f.rel, gzipSync(buf));
        // 索引：每个文件取其内容的采样，避免索引膨胀
        indexParts.push(f.rel, plainForIndex(content).slice(0, SAMPLE_CHARS));
      }

      insSkill.run(
        name, fm.name || name, fm.description || meta.description || '',
        JSON.stringify(meta.tags || []), meta.owner || meta.sourceRepo || '',
        mdFiles.length, textBytes, meta.syncedAt || ''
      );
      insFts.run(skillId, tokenize(indexParts.join(' \n ')));

      totalBytes += textBytes;
      done++;
      if (done % 25 === 0) {
        process.stdout.write(`\r  已索引 ${done}/${dirs.length} 个 Skill   `);
      }
    } catch (e) {
      skipped++;
    }
  }

  db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)').run('builtAt', new Date().toISOString());
  db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)').run('skillCount', String(done));
  db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)').run('fileCount', String(totalFiles));
  db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)').run('textBytes', String(totalBytes));
  db.prepare('INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)').run('tokenizer', 'bigram-zh + word-en');
  db.exec("INSERT INTO skills_fts(skills_fts) VALUES ('optimize')");
  db.exec('VACUUM');
  db.close();

  if (existsSync(OUT)) await unlink(OUT);
  await rename(TMP, OUT);

  const st = await stat(OUT);
  const el = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n\n${'─'.repeat(62)}`);
  console.log(`已索引 ${done} 个 Skill${skipped ? `（跳过 ${skipped}）` : ''}，${totalFiles} 个文件  用时 ${el}s`);
  console.log(`文本总量：${(totalBytes / 1048576).toFixed(2)} MB  →  数据库 ${(st.size / 1048576).toFixed(2)} MB`);
  console.log(`输出：${OUT}`);
  console.log(`\n查询：node scripts/search-skills.mjs "关键词"`);
}

main().catch((e) => { console.error('\n构建失败：', e); process.exit(1); });
