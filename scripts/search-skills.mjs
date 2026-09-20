#!/usr/bin/env node
/**
 * search-skills.mjs — 官方 HarmonyOS Skill 检索（本地 SQLite 索引）
 *
 * 查询 references/huawei-skills.db（由 build-skill-index.mjs 构建）。
 *
 * 用法：
 *   node scripts/search-skills.mjs "arkui"                     # 检索
 *   node scripts/search-skills.mjs "状态管理" --tag ArkUI
 *   node scripts/search-skills.mjs "性能" --limit 30
 *   node scripts/search-skills.mjs --list                      # 列出全部
 *   node scripts/search-skills.mjs --tags                      # 列出分类
 *   node scripts/search-skills.mjs --read hmos-arkui-develop-skill          # 看 SKILL.md
 *   node scripts/search-skills.mjs --read hmos-arkui-develop-skill/references/xxx.md
 *   node scripts/search-skills.mjs --stats
 *
 * 安装某个 Skill 到本地代理（需 DevEco CLI）：
 *   devecocli skills add --skill <name> --agent claude-code
 */
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { buildMatch } from './lib/tokenize.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(HERE, '..');
const DB_PATH = join(SKILL_ROOT, 'references', 'huawei-skills.db');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const optVal = (n, d = '') => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const VALUE_FLAGS = new Set(['--tag', '--limit', '--read']);
const keywords = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { if (VALUE_FLAGS.has(a)) i++; continue; }
  if (i > 0 && VALUE_FLAGS.has(argv[i - 1])) continue;
  keywords.push(a);
}

const OPT = {
  tag: optVal('--tag'),
  limit: parseInt(optVal('--limit', '15'), 10),
  read: optVal('--read'),
  any: flags.has('--any'),
  json: flags.has('--json'),
  list: flags.has('--list'),
  tags: flags.has('--tags'),
  stats: flags.has('--stats'),
};

function readBody(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try { return gunzipSync(v).toString('utf8'); } catch { return Buffer.from(v).toString('utf8'); }
}

function openDb() {
  if (!existsSync(DB_PATH)) {
    console.error(`未找到 Skill 索引：${DB_PATH}`);
    console.error('');
    console.error('请先构建：');
    console.error('  node scripts/sync-huawei-skills.mjs --download --tag HMOS');
    console.error('  node scripts/build-skill-index.mjs');
    process.exit(1);
  }
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

function main() {
  const db = openDb();

  if (OPT.stats) {
    const meta = Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map((r) => [r.key, r.value]));
    const size = statSync(DB_PATH).size;
    if (OPT.json) { console.log(JSON.stringify({ db: DB_PATH, size, meta }, null, 2)); return; }
    console.log(`Skill 索引：${DB_PATH}`);
    console.log(`大小：${(size / 1048576).toFixed(2)} MB`);
    console.log(`Skill：${meta.skillCount || '?'} 个，文件：${meta.fileCount || '?'} 个`);
    console.log(`文本总量：${meta.textBytes ? (Number(meta.textBytes) / 1048576).toFixed(2) + ' MB' : '?'}`);
    console.log(`构建：${meta.builtAt || '?'}`);
    console.log(`分词：${meta.tokenizer || '?'}`);
    return;
  }

  if (OPT.tags) {
    const rows = db.prepare('SELECT tags FROM skills').all();
    const counts = new Map();
    for (const r of rows) {
      let tags = [];
      try { tags = JSON.parse(r.tags || '[]'); } catch { /* 忽略 */ }
      for (const t of tags) counts.set(t, (counts.get(t) || 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (OPT.json) { console.log(JSON.stringify(sorted, null, 2)); return; }
    console.log(`Skill 分类（共 ${sorted.length} 个）：\n`);
    sorted.forEach(([t, n]) => console.log(`  ${String(n).padStart(5)}  ${t}`));
    console.log('\n用 --tag <分类名> 限定检索。');
    return;
  }

  if (OPT.read) {
    const [skillName, ...rest] = OPT.read.split('/');
    const filePath = rest.join('/') || 'SKILL.md';
    const skill = db.prepare('SELECT * FROM skills WHERE name = ?').get(skillName);
    if (!skill) {
      console.error(`未找到 Skill：${skillName}`);
      console.error('提示：用 node scripts/search-skills.mjs --list 查看全部。');
      process.exit(1);
    }
    const file = db.prepare('SELECT path, content FROM files WHERE skill_id = ? AND path = ?')
      .get(skill.id, filePath);
    if (!file) {
      const avail = db.prepare('SELECT path FROM files WHERE skill_id = ? ORDER BY path').all(skill.id);
      console.error(`未找到文件：${filePath}`);
      console.error(`该 Skill 包含 ${avail.length} 个文件：`);
      avail.slice(0, 40).forEach((f) => console.error(`  ${f.path}`));
      process.exit(1);
    }
    if (OPT.json) { console.log(JSON.stringify({ ...skill, path: file.path, content: readBody(file.content) }, null, 2)); return; }
    console.log(`# ${skill.title || skill.name}`);
    console.log(`> Skill：${skill.name}  |  文件：${filePath}`);
    if (skill.description) console.log(`> 说明：${skill.description}`);
    console.log('');
    console.log(readBody(file.content));
    return;
  }

  // 列表 / 检索
  let rows;
  if (OPT.list) {
    rows = db.prepare('SELECT id, name, title, description, tags, file_count FROM skills ORDER BY name').all();
  } else {
    if (keywords.length === 0) {
      console.error('用法：node scripts/search-skills.mjs <关键词...> [选项]');
      console.error('      node scripts/search-skills.mjs --list | --tags | --stats');
      console.error('      node scripts/search-skills.mjs --read <skill-name>[/<文件路径>]');
      process.exit(1);
    }
    const match = buildMatch(keywords, OPT.any);
    if (!match) { console.error('关键词无法分词。'); process.exit(1); }
    rows = db.prepare(`
      SELECT s.id, s.name, s.title, s.description, s.tags, s.file_count,
             bm25(skills_fts) AS score
      FROM skills_fts f JOIN skills s ON s.id = f.rowid
      WHERE skills_fts MATCH ?
      ORDER BY score LIMIT ?`).all(match, OPT.limit * 5);

    // 名称/标题命中优先
    const kwsLower = keywords.map((k) => k.toLowerCase());
    rows = rows.map((r) => {
      const hay = `${r.name} ${r.title || ''}`.toLowerCase();
      const hits = kwsLower.filter((k) => hay.includes(k)).length;
      return { ...r, hits, sortKey: (hits > 0 ? -1000 : 0) + r.score };
    }).sort((a, b) => a.sortKey - b.sortKey).slice(0, OPT.limit);
  }

  // 分类过滤
  if (OPT.tag) {
    rows = rows.filter((r) => {
      try { return JSON.parse(r.tags || '[]').some((t) => t.toLowerCase() === OPT.tag.toLowerCase()); }
      catch { return false; }
    });
  }

  if (OPT.json) {
    console.log(JSON.stringify({
      keywords, tag: OPT.tag || null, count: rows.length,
      results: rows.map((r) => ({ name: r.name, title: r.title, description: r.description,
        tags: JSON.parse(r.tags || '[]'), files: r.file_count })),
    }, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log('未找到匹配的 Skill。');
    console.log('建议：换更短的关键词，或去掉 --tag 限定，或先用 --list 浏览。');
    return;
  }

  const header = OPT.list ? `全部 ${rows.length} 个 Skill` : `命中 ${rows.length} 个 Skill`;
  console.log(`${header}${OPT.tag ? `（分类：${OPT.tag}）` : ''}\n`);

  rows.forEach((r, i) => {
    let tags = [];
    try { tags = JSON.parse(r.tags || '[]'); } catch { /* 忽略 */ }
    const flag = !OPT.list && r.hits > 0 ? ' ★' : '';
    console.log(`${String(i + 1).padStart(3)}. ${r.name}${flag}`);
    if (r.title && r.title !== r.name) console.log(`     标题：${r.title}`);
    if (tags.length) console.log(`     分类：${tags.join(' / ')}  ·  ${r.file_count} 个文件`);
    if (r.description) {
      console.log(`     ${String(r.description).replace(/\s+/g, ' ').slice(0, 160)}`);
    }
    console.log('');
  });

  console.log(`查看内容：node scripts/search-skills.mjs --read ${rows[0].name}`);
  console.log('★ = 名称或标题命中');
}

try { main(); } catch (e) { console.error('检索失败：', e.message); process.exit(1); }
