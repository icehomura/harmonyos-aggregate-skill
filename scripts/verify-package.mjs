#!/usr/bin/env node
/**
 * verify-package.mjs — 技能包完整性校验
 *
 * 检查项：
 *   1. skill.yaml 的 routing / subskills 引用的文件是否存在
 *   2. SKILL.md / AGENTS.md / README.md 里的相对 Markdown 链接是否有效
 *   3. 声明的知识库（.db）是否就位，元数据是否合理
 *   4. .gitignore / .gitattributes 是否覆盖了大体积中间产物
 *
 * 用途：技能包会持续更新（官方文档改版、新增分技能），此脚本防止链接腐烂。
 *
 * 用法：
 *   node scripts/verify-package.mjs
 *   node scripts/verify-package.mjs --json
 */
import { readFile, access, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve, relative, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const JSON_OUT = process.argv.includes('--json');

const problems = [];
const warns = [];
const oks = [];

const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

// ───────────────────── 1. skill.yaml 引用 ─────────────────────
async function checkSkillYaml() {
  const p = join(ROOT, 'skill.yaml');
  if (!existsSync(p)) { problems.push('skill.yaml 缺失'); return; }
  const text = await readFile(p, 'utf8');

  // 提取所有 `load:` / `path:` / `db:` / `files:` 值
  const refs = new Set();
  for (const m of text.matchAll(/^\s*(?:load|path|db|files|entrypoint):\s*(\S+)\s*$/gm)) {
    refs.add(m[1].replace(/^["']|["']$/g, ''));
  }
  for (const r of refs) {
    // 跳过中间产物目录（它们由同步脚本按需重建，不入库）
    if (/^(references\/huawei-docs\/|references\/huawei-skills\/|references\/deveco-docs\/)/.test(r)) continue;
    const full = join(ROOT, r);
    if (await exists(full)) oks.push(`skill.yaml → ${r}`);
    else problems.push(`skill.yaml 引用了不存在的路径：${r}`);
  }
}

// ───────────────────── 2. Markdown 链接 ─────────────────────
async function checkMarkdownLinks() {
  const docs = [];
  for (const f of ['SKILL.md', 'AGENTS.md', 'README.md', 'README.en.md',
                   'skills/harmonyos-docs-sync/SKILL.md']) {
    if (existsSync(join(ROOT, f))) docs.push(f);
  }
  // references 下手写的文档（跳过知识库原始文件）
  async function collect(dir, depth = 0) {
    if (depth > 2) return;
    let entries = [];
    try { entries = await (await import('node:fs/promises')).readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (['huawei-docs', 'huawei-skills', 'deveco-docs', 'base'].includes(e.name)) continue;
        await collect(full, depth + 1);
      } else if (e.name.endsWith('.md')) {
        docs.push(rel(full));
      }
    }
  }
  await collect(join(ROOT, 'references'));

  for (const doc of docs) {
    const text = await readFile(join(ROOT, doc), 'utf8');
    const base = dirname(join(ROOT, doc));
    for (const m of text.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
      let target = m[2].trim();
      if (/^(https?:|mailto:|#)/.test(target)) continue;      // 外链与锚点跳过
      target = target.split('#')[0];                          // 去锚点
      if (!target) continue;
      const full = normalize(join(base, target));
      if (!(await exists(full))) {
        problems.push(`${doc} 的链接失效：${m[2]}`);
      }
    }
  }
  oks.push(`检查 ${docs.length} 份 Markdown 的内部链接`);
}

// ───────────────────── 3. 知识库 ─────────────────────
async function checkKnowledgeBases() {
  const dbs = [
    { path: join(ROOT, 'references', 'huawei-docs.db'), label: '文档索引', minDocs: 30000 },
    { path: join(ROOT, 'references', 'huawei-skills.db'), label: 'Skill 索引', minDocs: 50 },
  ];
  for (const { path, label, minDocs } of dbs) {
    if (!existsSync(path)) {
      warns.push(`${label} 未就位（${rel(path)}）—— 需运行 sync + build 脚本生成`);
      continue;
    }
    try {
      const st = await stat(path);
      const db = new DatabaseSync(path, { readOnly: true });
      const meta = Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map((r) => [r.key, r.value]));
      const count = Number(meta.docCount || meta.skillCount || 0);
      db.close();
      if (count < minDocs) warns.push(`${label} 条目偏少（${count}）`);
      else oks.push(`${label}：${count} 条，${(st.size / 1048576).toFixed(1)} MB`);
    } catch (e) {
      problems.push(`${label} 无法读取：${e.message}`);
    }
  }
}

// ───────────────────── 4. 忽略规则 ─────────────────────
async function checkIgnoreRules() {
  const gi = existsSync(join(ROOT, '.gitignore'))
    ? await readFile(join(ROOT, '.gitignore'), 'utf8') : '';
  const ga = existsSync(join(ROOT, '.gitattributes'))
    ? await readFile(join(ROOT, '.gitattributes'), 'utf8') : '';

  if (!gi) problems.push('.gitignore 缺失');
  else {
    for (const must of ['references/huawei-docs/', 'references/huawei-skills/', '.cache/']) {
      if (!gi.includes(must)) problems.push(`.gitignore 未忽略 ${must}（会导致数万文件入库）`);
    }
    if (!gi.includes('references/deveco-docs/')) warns.push('.gitignore 未忽略 references/deveco-docs/');
    else oks.push('.gitignore 已忽略大体积中间产物');
  }

  if (!ga) problems.push('.gitattributes 缺失（Git LFS 未配置）');
  else if (!/\.db\s+filter=lfs/.test(ga)) problems.push('.gitattributes 未把 *.db 交给 Git LFS');
  else oks.push('.gitattributes 已把 *.db 交给 Git LFS');
}

// ───────────────────── 5. YAML 基础语法 ─────────────────────
/**
 * 零依赖的 YAML 陷阱检查。完整解析需要 yaml 依赖，与「脚本零依赖」冲突，
 * 因此只检测最容易踩的两类错误（这两类都是实测踩过的）：
 *   ① flow sequence 中以 @ 开头的值未加引号 —— YAML 里 @ 是保留字符
 *   ② "key:{" / "key:[" 冒号后缺空格 —— YAML 要求 "key: value"
 * 如需完整校验：npx --yes yaml 或临时安装 yaml 包后 YAML.parse()。
 */
async function checkYamlSyntax() {
  const files = ['skill.yaml', 'SKILL.md'];
  for (const f of files) {
    const full = join(ROOT, f);
    if (!existsSync(full)) continue;
    let text = await readFile(full, 'utf8');
    // SKILL.md 只校验 frontmatter
    if (f.endsWith('.md')) {
      const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
      if (!m) { warns.push(`${f} 缺少 frontmatter`); continue; }
      text = m[1];
    }
    const lines = text.split(/\r?\n/);
    let bad = 0;
    lines.forEach((line, i) => {
      if (/^\s*#/.test(line)) return;
      // ① flow sequence 中的 @ 开头值
      if (/\[[^\]]*[,\[]\s*@/.test(line)) {
        problems.push(`${f}:${i + 1} 数组中以 @ 开头的值必须加引号（YAML 保留字符）：${line.trim().slice(0, 70)}`);
        bad++;
      }
      // ② 冒号后缺空格
      if (/^\s*[\w.-]+:(?:\{|\[)/.test(line)) {
        problems.push(`${f}:${i + 1} 冒号后缺少空格（YAML 要求 "key: value"）：${line.trim().slice(0, 70)}`);
        bad++;
      }
    });
    if (bad === 0) oks.push(`${f} YAML 基础语法检查通过`);
  }
}

// ───────────────────── 主流程 ─────────────────────
async function main() {
  await checkSkillYaml();
  await checkMarkdownLinks();
  await checkKnowledgeBases();
  await checkIgnoreRules();
  await checkYamlSyntax();

  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: oks, warnings: warns, problems }, null, 2));
    process.exit(problems.length ? 1 : 0);
  }

  console.log('技能包完整性校验');
  console.log('─'.repeat(62));
  oks.forEach((o) => console.log(`  ✓ ${o}`));
  if (warns.length) {
    console.log('');
    warns.forEach((w) => console.log(`  ! ${w}`));
  }
  if (problems.length) {
    console.log('');
    problems.forEach((p) => console.log(`  ✗ ${p}`));
    console.log(`\n${problems.length} 个问题需要修复。`);
    process.exit(1);
  }
  console.log(`\n全部通过${warns.length ? `（${warns.length} 条提示）` : ''}。`);
}

main().catch((e) => { console.error('校验失败：', e); process.exit(1); });
