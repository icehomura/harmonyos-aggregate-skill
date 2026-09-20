#!/usr/bin/env node
/**
 * sync-huawei-skills.mjs — 华为/开放原子官方 HarmonyOS Skill 同步器
 *
 * 数据源：开放原子 OpenHarmony Matrix 平台（DevEco CLI 的 skills 命令同源）
 *   GET  https://matrix.openharmony.cn/api/model_base/model/tags?serviceType=skill
 *   POST https://matrix.openharmony.cn/api/registry/skill/skills?pageNum=&pageSize=&tagIds[]=&keyword=
 *   GET  https://matrix.openharmony.cn/api/registry/skill/{id}/checksum          → {size, sha256}
 *   GET  https://matrix.openharmony.cn/api/registry/skill/{id}/install?format=zip → 二进制 zip
 *
 * 用法：
 *   node sync-huawei-skills.mjs --list                    # 列出分类与数量统计
 *   node sync-huawei-skills.mjs --list --tag HMOS         # 列出某分类下的 skill
 *   node sync-huawei-skills.mjs --find arkui              # 关键词搜索（不下载）
 *   node sync-huawei-skills.mjs --download --tag HMOS     # 下载某分类全部
 *   node sync-huawei-skills.mjs --download --all          # 下载全部（慎用，4130+ 个）
 *   node sync-huawei-skills.mjs --download --find arkui   # 下载搜索结果
 *
 * 断点续跑：已存在且校验通过的 skill 会跳过。--force 强制重下。
 */
import { mkdir, writeFile, readFile, access, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(HERE, '..');
const OUT_DIR = join(SKILL_ROOT, 'references', 'huawei-skills');
const INDEX_PATH = join(SKILL_ROOT, 'references', 'huawei-skills-index.json');

const BASE = 'https://matrix.openharmony.cn';
const TAGS_API = `${BASE}/api/model_base/model/tags?serviceType=skill`;
const SKILLS_API = `${BASE}/api/registry/skill/skills`;
const SKILL_BASE = `${BASE}/api/registry/skill`;
const SUCCESS = '20000';
const PAGE_SIZE = 20;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ───────────────────────── CLI ─────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d = '') => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const OPT = {
  list: has('--list'),
  find: val('--find'),
  tag: val('--tag'),
  download: has('--download'),
  all: has('--all'),
  force: has('--force'),
  concurrency: parseInt(val('--concurrency', '6'), 10),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(url, opts = {}, retries = 4) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    if (i > 0) await sleep(400 * 2 ** i + Math.random() * 300);
    try {
      const res = await fetch(url, { ...opts, headers: { 'User-Agent': UA, Accept: 'application/json', ...(opts.headers || {}) } });
      if (res.status >= 500 || res.status === 429) { lastErr = new Error(`HTTP ${res.status}`); continue; }
      return res;
    } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error('request failed');
}

async function getJson(url, opts) {
  const res = await req(url, opts);
  const text = await res.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`${url} → 非 JSON 响应 (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (j.code !== SUCCESS) throw new Error(`${url} → code=${j.code} ${j.message || ''}`);
  return j.data;
}

// ───────────────────── 数据获取 ─────────────────────
// 注意：该接口从 request body 读取参数（非 query string）。
async function querySkills({ pageNum, pageSize = PAGE_SIZE, tagId = '', keyword = '' }) {
  const body = { pageNum, pageSize };
  if (tagId) body.tagIds = [tagId];
  if (keyword) body.keyword = keyword;
  return getJson(SKILLS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function getTags() {
  const d = await getJson(TAGS_API);
  return d.skill || [];
}

async function listByTag(tagId) {
  const out = [];
  for (let page = 1; page <= 500; page++) {
    const d = await querySkills({ pageNum: page, tagId });
    const list = d.list || [];
    out.push(...list);
    process.stdout.write(`\r  拉取中… 第 ${page} 页，累计 ${out.length}/${d.count ?? '?'}   `);
    if (list.length < PAGE_SIZE) break;
  }
  process.stdout.write('\n');
  return out;
}

async function search(keyword, tagId) {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const d = await querySkills({ pageNum: page, tagId, keyword });
    const list = d.list || [];
    out.push(...list);
    if (list.length < PAGE_SIZE) break;
  }
  return out;
}

// checksum / install 的路径参数是 skill 的 **name**（不是 id），
// install 会 302 跳转到华为 OBS；fetch 默认跟随重定向。
async function checksum(name) {
  return getJson(`${SKILL_BASE}/${encodeURIComponent(name)}/checksum`);
}

async function downloadZip(name) {
  const res = await req(`${SKILL_BASE}/${encodeURIComponent(name)}/install?format=zip`, { method: 'GET' });
  if (!res.ok) throw new Error(`install HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** 解压 zip 到目标目录。优先用 bsdtar（Win10+/macOS/Linux 通用），回退 unzip。 */
function extractZip(zipPath, destDir) {
  const attempts = [
    ['tar', ['-xf', zipPath, '-C', destDir]],
    ['unzip', ['-q', '-o', zipPath, '-d', destDir]],
  ];
  let lastErr = null;
  for (const [cmd, args] of attempts) {
    try {
      execFileSync(cmd, args, { stdio: 'ignore' });
      return true;
    } catch (e) { lastErr = e; }
  }
  throw new Error(`解压失败: ${lastErr?.message || '无可用解压工具'}`);
}

// ───────────────────── 输出 ─────────────────────
const fmtSize = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b > 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`;

function printSkill(s, i) {
  const tags = (s.tags || []).map((t) => t.name).join('/');
  console.log(`${String(i + 1).padStart(4)}. ${s.name}`);
  console.log(`      id=${s.id}  tags=${tags || '-'}`);
  if (s.description) console.log(`      ${String(s.description).replace(/\s+/g, ' ').slice(0, 140)}`);
  if (s.owner?.account) console.log(`      owner=${s.owner.account}${s.owner.source ? ' @' + s.owner.source : ''}`);
}

async function main() {
  console.log('HarmonyOS 官方 Skill 同步器  (matrix.openharmony.cn)');
  console.log('─'.repeat(64));

  // 1) 分类模式
  if (!OPT.find && !OPT.download) {
    const tags = await getTags();
    console.log(`\n可用分类 (${tags.length})：\n`);
    for (const t of tags) {
      console.log(`  ${String(t.name).padEnd(20)} ${String(t.enName).padEnd(24)} id=${t.id}  ${t.type || ''}`);
    }
    console.log('\n提示：用 --list --tag <名称> 查看该分类下的 skill；用 --download --tag <名称> 下载。');
    return;
  }

  // 2) 定位 tag
  let tagId = '';
  let tagName = '';
  if (OPT.tag) {
    const tags = await getTags();
    const hit = tags.find((t) => t.name === OPT.tag || t.enName === OPT.tag);
    if (!hit) { console.error(`未找到分类 "${OPT.tag}"。用 --list 查看可用分类。`); process.exit(1); }
    tagId = hit.id; tagName = hit.name;
    console.log(`分类：${tagName} (${tagId})\n`);
  }

  // 3) 取列表
  console.log(OPT.find ? `搜索关键词："${OPT.find}"` : `列出全部${tagName ? '（分类：' + tagName + '）' : ''}…`);
  let items = OPT.find ? await search(OPT.find, tagId) : await listByTag(tagId);
  // DevEco CLI 的默认过滤：排除 tag 含 DevEco 的条目
  items = items.filter((s) => !(s.tags || []).some((t) => t.name === 'DevEco'));
  console.log(`共 ${items.length} 个 skill\n`);

  // 4) 只列出
  if (!OPT.download) {
    items.forEach((s, i) => printSkill(s, i));
    console.log(`\n合计 ${items.length} 个。加 --download 开始下载。`);
    return;
  }

  // 5) 下载
  await mkdir(OUT_DIR, { recursive: true });
  const index = existsSync(INDEX_PATH) ? JSON.parse(await readFile(INDEX_PATH, 'utf8')) : { syncedAt: '', skills: {} };

  let done = 0, skipped = 0, failed = 0, bytes = 0;
  const t0 = Date.now();
  let cursor = 0;

  const progress = () => {
    const el = (Date.now() - t0) / 1000;
    process.stdout.write(`\r  下载 ${done}  跳过 ${skipped}  失败 ${failed}  |  ${(done / Math.max(el, .001)).toFixed(1)} 个/s  |  ${fmtSize(bytes)}   `);
  };

  async function worker() {
    while (cursor < items.length) {
      const s = items[cursor++];
      const safe = s.name.replace(/[^A-Za-z0-9._-]/g, '_');
      const dir = join(OUT_DIR, safe);
      try {
        const meta = await checksum(s.name);
        const marker = join(dir, '.sync.json');
        if (!OPT.force && existsSync(marker)) {
          const prev = JSON.parse(await readFile(marker, 'utf8'));
          if (prev.sha256 && meta.sha256 && prev.sha256 === meta.sha256) { skipped++; progress(); continue; }
        }
        const buf = await downloadZip(s.name);
        if (meta.size && buf.length !== meta.size) throw new Error(`size mismatch ${buf.length} != ${meta.size}`);
        const sha = createHash('sha256').update(buf).digest('hex');
        if (meta.sha256 && sha.toLowerCase() !== String(meta.sha256).toLowerCase()) throw new Error('sha256 mismatch');

        await mkdir(dir, { recursive: true });
        const zipPath = join(dir, `${safe}.zip`);
        await writeFile(zipPath, buf);
        extractZip(zipPath, dir);          // 解压出 SKILL.md / references / assets
        await rm(zipPath, { force: true }); // 解压后删除 zip，仅保留 .sync.json 校验信息
        await writeFile(marker, JSON.stringify({
          id: s.id, name: s.name, description: s.description || '',
          tags: (s.tags || []).map((t) => t.name),
          owner: s.owner?.account || '', sourceRepo: s.owner?.source || '',
          sha256: sha, size: buf.length, syncedAt: new Date().toISOString(),
        }, null, 2), 'utf8');

        index.skills[s.id] = {
          name: s.name, dir: `references/huawei-skills/${safe}`,
          tags: (s.tags || []).map((t) => t.name), description: s.description || '',
          size: buf.length, sha256: sha,
        };
        bytes += buf.length; done++;
        if (done % 25 === 0) {
          index.syncedAt = new Date().toISOString();
          index.total = Object.keys(index.skills).length;
          await writeFile(INDEX_PATH, JSON.stringify(index, null, 1), 'utf8');
        }
      } catch (e) {
        failed++;
        console.error(`\n  ✗ ${s.name}: ${e.message}`);
      }
      progress();
    }
  }

  await Promise.all(Array.from({ length: OPT.concurrency }, () => worker()));

  index.syncedAt = new Date().toISOString();
  index.total = Object.keys(index.skills).length;
  await writeFile(INDEX_PATH, JSON.stringify(index, null, 1), 'utf8');

  const el = (Date.now() - t0) / 1000;
  console.log(`\n\n${'─'.repeat(64)}`);
  console.log(`完成 ${done}  跳过 ${skipped}  失败 ${failed}  用时 ${Math.floor(el / 60)}m${Math.floor(el % 60)}s  共 ${fmtSize(bytes)}`);
  console.log(`输出目录：${OUT_DIR}`);
  console.log(`索引：${INDEX_PATH}`);
}

main().catch((e) => { console.error('\n致命错误：', e); process.exit(1); });
