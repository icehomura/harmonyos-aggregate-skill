#!/usr/bin/env node
/**
 * fetch-huawei-doc.mjs — 单篇官方文档抓取 / 刷新
 *
 * 用途：
 *   1. 按需抓取某篇官方文档（不必全量同步）
 *   2. **刷新图片链接** —— 华为 CDN 图片是签名 URL，约 24h 过期。
 *      需要查看已归档文档中的图片时，用它重新拉取该页获取新鲜链接。
 *   3. 下载该页图片到本地
 *
 * 用法：
 *   node scripts/fetch-huawei-doc.mjs <objectId> --catalog <板块>        # 打印 Markdown
 *   node scripts/fetch-huawei-doc.mjs <objectId> --catalog design-guides --write
 *   node scripts/fetch-huawei-doc.mjs <objectId> --catalog design-guides --images ./out
 *
 * 示例：
 *   node scripts/fetch-huawei-doc.mjs corner-radius-parameter-0000002556468705 --catalog design-guides
 *   node scripts/fetch-huawei-doc.mjs bpta-spatiality-immersive --catalog best-practices --images ./tmp
 */
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(HERE, '..');
const DOCS_ROOT = join(SKILL_ROOT, 'references', 'huawei-docs');

const API = 'https://svc-drcn.developer.huawei.com/community/servlet/consumer/cn/documentPortal/getDocumentById';
const HEADERS = {
  'Content-Type': 'application/json;charset=UTF-8',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://developer.huawei.com',
  'Referer': 'https://developer.huawei.com/consumer/cn/doc/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// ───────────────────────── CLI ─────────────────────────
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const optVal = (n, d = '') => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const positional = argv.filter((a) => !a.startsWith('--'));
const objectId = positional[0];
const catalog = optVal('--catalog');
const imagesDir = optVal('--images');
const doWrite = flags.has('--write');
const listImages = flags.has('--list-images');

if (!objectId) {
  console.error(`用法：
  node scripts/fetch-huawei-doc.mjs <objectId> --catalog <板块> [--write] [--images <目录>] [--list-images]

示例：
  node scripts/fetch-huawei-doc.mjs corner-radius-parameter-0000002556468705 --catalog design-guides

提示：objectId 是官方 URL 的最后一段，
  如 .../design-guides/corner-radius-parameter-0000002556468705 → objectId 即该段。`);
  process.exit(1);
}

// 未指定 catalog 时，尝试从本地归档推断
async function inferCatalog(id) {
  if (catalog) return catalog;
  if (!existsSync(DOCS_ROOT)) return '';
  const cats = await readdir(DOCS_ROOT, { withFileTypes: true });
  for (const c of cats) {
    if (!c.isDirectory()) continue;
    if (existsSync(join(DOCS_ROOT, c.name, `${id}.md`))) return c.name;
  }
  return '';
}

const unescapeHtml = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));

const stripTags = (s) => unescapeHtml(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

function extractImages(html) {
  const seen = new Set();
  const out = [];
  for (const m of html.matchAll(/<img\b[^>]*?src=["']([^"']+)["'][^>]*>/gi)) {
    const url = unescapeHtml(m[1]);
    if (seen.has(url)) continue;
    seen.add(url);
    const name = decodeURIComponent(url.split('/').pop().split('?')[0]);
    out.push({ url, name });
  }
  return out;
}

async function downloadImage(img, dir) {
  const res = await fetch(img.url, { headers: { 'User-Agent': HEADERS['User-Agent'] } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dir, { recursive: true });
  const path = join(dir, img.name);
  await writeFile(path, buf);
  return { path, bytes: buf.length };
}

async function main() {
  const cat = await inferCatalog(objectId);
  if (!cat) {
    console.error(`无法确定板块。请显式指定 --catalog。\n已知板块可用：node scripts/search-docs.mjs --list-catalogs`);
    process.exit(1);
  }

  console.log(`拉取 ${cat}/${objectId} …`);
  const res = await fetch(API, {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ objectId, version: '', catalogName: cat, language: 'cn' }),
  });
  const j = await res.json();
  if (j.code !== 0 || !j.value) {
    console.error(`拉取失败：code=${j.code} ${j.message || ''}`);
    process.exit(1);
  }

  const v = j.value;
  const html = v.content?.content || '';
  const imgs = extractImages(html);
  const sourceUrl = `https://developer.huawei.com/consumer/cn/doc/${cat}/${objectId}`;

  console.log(`标题：${v.title}`);
  console.log(`更新：${v.updatedDate}`);
  console.log(`图片：${imgs.length} 张（签名约 24h 过期）`);

  // 只列图片
  if (listImages) {
    imgs.forEach((im, i) => console.log(`${String(i + 1).padStart(3)}. ${im.name}\n     ${im.url}`));
    return;
  }

  // 下载图片（使用刚拿到的新鲜签名链接）
  if (imagesDir) {
    console.log(`\n下载图片到 ${imagesDir} …`);
    let ok = 0, fail = 0;
    for (const im of imgs) {
      try {
        const r = await downloadImage(im, imagesDir);
        ok++;
        console.log(`  ✓ ${im.name}  ${(r.bytes / 1024).toFixed(0)} KB`);
      } catch (e) {
        fail++;
        console.log(`  ✗ ${im.name}  ${e.message}`);
      }
    }
    console.log(`完成：成功 ${ok}，失败 ${fail}`);
    if (!doWrite) return;
  }

  // 刷新归档文件的图片链接
  const archived = join(DOCS_ROOT, cat, `${objectId}.md`);
  if (doWrite && existsSync(archived)) {
    const old = await readFile(archived, 'utf8');
    const head = old.split('## 正文')[0];
    const body = old.split('## 正文')[1] || '';
    // 用新链接替换正文中的旧链接
    let updated = body;
    const oldImgs = extractImages(body.replace(/!\[[^\]]*\]\(([^)]+)\)/g, (m, u) => `<img src="${u}">`));
    for (let i = 0; i < Math.min(oldImgs.length, imgs.length); i++) {
      if (oldImgs[i].url !== imgs[i].url) updated = updated.split(oldImgs[i].url).join(imgs[i].url);
    }
    const listSection = ['## 图片清单', '',
      '> 注意：华为 CDN 图片为**签名 URL，约 24 小时过期**。需要查看图片时，用 `scripts/fetch-huawei-doc.mjs` 重新拉取本页以获取新鲜链接，再下载对应图片。', ''];
    imgs.forEach((im, i) => {
      listSection.push(`${i + 1}. \`${im.name}\``);
      listSection.push(`   - ${im.url}`);
    });
    listSection.push('');
    const next = head + '## 正文' + (updated.split('## 图片清单')[0] || '') + listSection.join('\n');
    await writeFile(archived, next, 'utf8');
    console.log(`\n已刷新归档文件：${archived}`);
    return;
  }

  // 默认：打印 Markdown 片段（含新鲜图片链接）
  console.log('\n' + '─'.repeat(60));
  console.log(`# ${v.title}\n`);
  console.log(`> 来源：${sourceUrl}`);
  console.log(`> 更新时间：${v.updatedDate}\n`);
  console.log(`图片直链（新鲜签名，可直接下载）：`);
  imgs.slice(0, 30).forEach((im, i) => console.log(`${String(i + 1).padStart(3)}. ${im.name}\n     ${im.url}`));
  if (imgs.length > 30) console.log(`  … 其余 ${imgs.length - 30} 张省略`);
  console.log(`\n加 --images <目录> 可下载全部图片；加 --write 可刷新归档文件。`);
}

main().catch((e) => { console.error('失败：', e.message); process.exit(1); });
