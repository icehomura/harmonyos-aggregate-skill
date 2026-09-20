# HarmonyOS Aggregate Skill

> Native ArkTS development skill pack for **HarmonyOS 6 / 7 (API 20 – 26)**, bundled with an
> offline official knowledge base.
>
> [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
> [![Docs](https://img.shields.io/badge/Official%20Docs-40%2C651%20indexed-green.svg)](#1-official-docs-40651-documents)
> [![Skills](https://img.shields.io/badge/Official%20Skills-144%20indexed-green.svg)](#2-official-skills-144)
> [![Node](https://img.shields.io/badge/Node.js-%E2%89%A5%2022.5-brightgreen.svg)](#requirements)
> [![Git LFS](https://img.shields.io/badge/Git%20LFS-required-orange.svg)](#%EF%B8%8F-read-before-cloning-git-lfs-is-required)

[简体中文](README.md) | **English**

> [!IMPORTANT]
> **Install [Git LFS](https://git-lfs.com) before cloning.** The offline knowledge base
> (~205 MB) is stored via LFS. Without it you only get **pointer files** and search will fail.
> See [⚠️ Read Before Cloning](#%EF%B8%8F-read-before-cloning-git-lfs-is-required) below.

> An **aggregate** skill pack that consolidates authoritative guidance scattered across
> 40,000+ official documents — design specs, project scaffolding, and official skills —
> into one place, with a **millisecond-latency offline SQLite knowledge base**.

Its core focus is the **Immersive Light Sense** material system — the foundation of
HarmonyOS 7's visual upgrade, and the area where official API names are most easily
misremembered (`backgroundMaterial` and `HdsMaterial` **do not exist**).

Its core focus is the **Immersive Light Sense** material system — the foundation of
HarmonyOS 7's visual upgrade, and the area where official API names are most easily
misremembered (`backgroundMaterial` and `HdsMaterial` **do not exist**).

## What Problem It Solves

| Pain point | How this pack addresses it |
|---|---|
| Official API names, enums, and parameters are easy to get wrong | `references/immersive-material/` lists **correct names alongside common misrememberings** |
| Material set but has no effect, with no clue why | Documents the **"effective scope" hard rule**, the failure log signature, and a troubleshooting table |
| Design values (corner radius / spacing / font size) are hard to find | `references/design-specs.md` — **every value cited to its official source**; unverified ones explicitly flagged |
| 40,000 official docs cannot be searched offline | Built-in SQLite full-text index, **0.4s** response |
| Official skills are scattered and hard to discover | 144 official skills indexed — searchable, full text readable, installable |
| Scaffolding a project from scratch is tedious | `assets/templates/` — official skeleton plus drop-in immersive-material files |
| Official docs keep changing | One command to **incrementally sync and rebuild the index** (see [companion skill](#companion-skill-harmonyos-docs-sync)) |

## ⚠️ Read Before Cloning: Git LFS Is Required

> The offline knowledge base (~205 MB) is managed via **[Git LFS](https://git-lfs.com)**.
> It is **not** part of normal git objects — without LFS you only receive a 133-byte
> **pointer file**, and search will fail immediately.

### 1. Install Git LFS (**before cloning**)

```bash
# macOS
brew install git-lfs

# Windows (pick one)
winget install GitHub.GitLFS
scoop install git-lfs
choco install git-lfs

# Ubuntu / Debian
sudo apt install git-lfs

# Fedora / RHEL
sudo dnf install git-lfs

# Other platforms / manual install: https://git-lfs.com
```

### 2. Enable it (once per machine)

```bash
git lfs install
```

### 3. Clone

```bash
git clone https://github.com/icehomura/harmonyos-aggregate-skill.git \
  ~/.claude/skills/harmonyos-aggregate-skill

# If the clone skipped LFS (e.g. --skip-smudge), or you got pointer files, pull manually:
cd ~/.claude/skills/harmonyos-aggregate-skill && git lfs pull
```

### Verify you got real data

```bash
head -c 60 references/huawei-docs.db
# ✓ binary garbage        → good, it is the real database
# ✗ version https://...   → still a pointer; run `git lfs pull`
```

### Cannot install LFS?

You can skip LFS entirely and **rebuild the knowledge base from the official sources**
(requires network, ~40 minutes):

```bash
node scripts/sync-huawei-docs.mjs     # Sync 40,651 official docs (~10 min)
node scripts/build-doc-index.mjs      # Rebuild the index (~30 min)
```

> See [Repository Size & Git LFS](#repository-size--git-lfs) for details.

---

## Quick Start

### Use as an AI skill

```bash
git clone https://github.com/icehomura/harmonyos-aggregate-skill.git \
  ~/.claude/skills/harmonyos-aggregate-skill
```

The agent loads it automatically for HarmonyOS / ArkTS / Immersive Light Sense tasks.

### Query the knowledge base

```bash
# Official docs (40,651 documents)
node scripts/search-docs.mjs "immersive light sense"
node scripts/search-docs.mjs "material level" --catalog harmonyos-guides
node scripts/search-docs.mjs --read harmonyos-guides/arkts-immersive-light-sense-overview
node scripts/search-docs.mjs --stats

# Official skills (144)
node scripts/search-skills.mjs "arkui state management"
node scripts/search-skills.mjs --list
node scripts/search-skills.mjs --read hmos-arkui-develop-skill
```

> The documents are **in Chinese** (the official docs are Chinese-first).

### Update the knowledge base

```bash
node scripts/sync-huawei-docs.mjs     # Incremental doc sync (~10 min)
node scripts/build-doc-index.mjs      # Rebuild index (~30 min → 172 MB)

node scripts/sync-huawei-skills.mjs --download --tag HMOS   # Sync official skills
node scripts/build-skill-index.mjs                          # Rebuild index (~30 s)
```

> For the full workflow (updating only design specs, refreshing expired image links,
> troubleshooting), see the
> [companion skill harmonyos-docs-sync](skills/harmonyos-docs-sync/SKILL.md).

## Repository Layout

```
.
├── SKILL.md                          Main skill entry point (the only AI trigger)
├── AGENTS.md                         Agent collaboration guide (workflow, hard rules)
├── skill.yaml                        Package structure, lazy-load routing, sync mechanism
├── LICENSE                           GPL-3.0
├── README.md                         Chinese README
├── README.en.md                      English README (this file)
│
├── references/
│   ├── immersive-material/          ★ Immersive Light Sense (core)
│   │   ├── README.md                 Level model, APIs, effective scope, power constraints, anti-patterns
│   │   └── safe-area.md              Safe area / notch / status bar avoidance
│   ├── project-architecture/         Directory layering, full configs, routing, services, ArkUI V2
│   ├── components/                  ★ Component implementations
│   │   ├── navigation.md             Bottom nav bar, capsule↔circle morphing, MiniBar
│   │   ├── sheet.md                  Modal drawer, child-component rules inside drawers
│   │   ├── circle-button.md          Circular buttons, "more" menu
│   │   └── lists.md                  Lists / grids / skeletons / pull-to-refresh
│   ├── theming/                     ★ Theming & appearance
│   │   ├── README.md                 Theme mode / 6 material levels / accent color / startup page
│   │   └── background-image.md       Custom background image (overlay / blur / dim)
│   ├── design-specs.md              ★ Official design values (all cited)
│   │
│   ├── huawei-docs.db               ← Full-text index of 40,651 docs (172 MB, Git LFS)
│   └── huawei-skills.db             ← Index of 144 skills (32 MB, Git LFS)
│
├── assets/templates/
│   ├── base/                        Official DevEco project skeleton (25 files)
│   └── immersive/                   3 drop-in immersive-material files
│
├── skills/
│   └── harmonyos-docs-sync/        ← Companion skill: doc sync & index rebuild
│       └── SKILL.md
│
└── scripts/                         Zero third-party dependencies (Node built-ins only)
    ├── lib/tokenize.mjs             CJK+Latin pre-tokenizer (shared by index & query — do not copy)
    ├── sync-huawei-docs.mjs         Sync official docs
    ├── build-doc-index.mjs          Build the doc SQLite index
    ├── search-docs.mjs              Doc search / read full text / stats
    ├── sync-huawei-skills.mjs       Sync official skills
    ├── build-skill-index.mjs        Build the skill SQLite index
    ├── search-skills.mjs            Skill search / read content
    ├── fetch-huawei-doc.mjs         Single-doc fetch (refresh expired image links)
    └── verify-package.mjs           Package integrity check
```

## Knowledge Base & Data Sources

The pack bundles two **offline retrieval copies**. Copyright for the original content
belongs to its respective owners; it is included here purely to enable offline lookup
and AI calls.

### 1. Official Docs (40,651 documents)

| Item | Detail |
|---|---|
| **Source** | Huawei Developer docs portal — `developer.huawei.com/consumer/cn/doc/` |
| **URL list** | Official sitemap: `/consumer/cn/sitemap/doc/sitemap1.xml` |
| **Content API** | `POST svc-drcn.developer.huawei.com/.../documentPortal/getDocumentById`<br>body: `{ objectId, catalogName, language: 'cn' }` |
| **Method** | Plain HTTP (**not** web scraping — the site is a SPA; a bare `curl` returns only an empty shell) |
| **Scale** | 40,651 docs / 91 catalogs / 275.8 MB source Markdown → 172.8 MB index |
| **Body encoding** | gzip BLOB (compressed to ~63% of source) |

**Top catalogs:**

| Count | Catalog | Content |
|---|---|---|
| 5,721 | `harmonyos-guides` | Development guides |
| 4,762 | `harmonyos-references` | **Component & API reference** |
| 4,595 | `harmonyos-faqs` | FAQs |
| 2,408 | `HMSCore-References` | HMS Core APIs |
| 2,364 | `AppGallery-connect-Guides` | AppGallery integration |
| 166 | `design-guides` | **Official design guidelines** (primary source for this pack's spec values) |

### 2. Official Skills (144)

| Item | Detail |
|---|---|
| **Source** | OpenAtom OpenHarmony Matrix — `matrix.openharmony.cn`<br>(the same backend used by DevEco CLI's `devecocli skills`) |
| **List API** | `POST /api/registry/skill/skills`, body: `{ pageNum, pageSize, tagIds[], keyword }` |
| **Install API** | `GET /api/registry/skill/{name}/install?format=zip` → 302 → Huawei OBS |
| **Integrity** | `GET /api/registry/skill/{name}/checksum` (sha256 + size) |
| **Scale** | 4,130 registered globally, ~200 HarmonyOS-related; this pack includes **144 / 7,538 files** |

**Included categories:** `HMOS`(41) · `OpenHarmony`(90) · `ArkTS`(16) · `ArkUI` ·
`鸿蒙开放能力`(12) · `DFX`(7) · `ASCF`(4) · `OpenHarmony性能技能库`

> ⚠️ The official `鸿蒙PC` category lists 2,314 entries, but it is a **catch-all**
> (containing `find-skills`, `data-analysis`, `legal-advisor`, etc. — unrelated to
> HarmonyOS) and is therefore **not included**.

### 3. DevEco Toolchain Docs

Source: the `docs.zip` bundled inside the npm package `@deveco/deveco-cli`
(31,477 files, including the official project template and a site-wide `search.db`).

### 4. Project Template

`assets/templates/base/` comes from the **official DevEco project template**
(25 files) bundled with `@deveco/deveco-cli`; file headers state Apache-2.0.

### Compliance

- Huawei's docs site declares `Content-Signal: ai-train=yes, search=yes, ai-input=yes`
  in its `robots.txt`
- This pack provides a **local retrieval copy** only — it does not modify the originals
  and is not intended for commercial redistribution
- Verify compliance with the origin sites' terms before redistributing this content

## Companion Skill: harmonyos-docs-sync

**Skill name: `harmonyos-docs-sync`** — responsible for syncing the knowledge base and
rebuilding its indexes.

| Purpose | Command |
|---|---|
| Full rebuild (after clone / index lost) | `sync-huawei-docs.mjs` → `build-doc-index.mjs` |
| Routine incremental update | `sync-huawei-docs.mjs` → `build-doc-index.mjs` |
| Design specs only (166 docs, seconds) | `sync-huawei-docs.mjs --catalog design-guides` |
| Official skill sync | `sync-huawei-skills.mjs --download --tag <category>` |
| Single doc fetch / refresh expired image links | `fetch-huawei-doc.mjs <objectId> --catalog <catalog>` |
| Package integrity check | `verify-package.mjs` |

**Install as a standalone skill** (optional, handy when you only do docs maintenance):

```bash
ln -s "$PWD/skills/harmonyos-docs-sync" ~/.claude/skills/harmonyos-docs-sync
```

Full documentation: [skills/harmonyos-docs-sync/SKILL.md](skills/harmonyos-docs-sync/SKILL.md).

## Repository Size & Git LFS

### Why the 40,000 Markdown files are not committed

Committing the raw files directly would cause severe **fragmentation**: one blob plus
one tree entry per file, making clones extremely slow and diffs/code review unreadable.
Therefore:

- **Raw Markdown / skill directories** → gitignored, treated as **local build intermediates**
- **SQLite indexes** → committed, managed by **Git LFS** (single files)

The repository therefore tracks **just over 50 files**, keeping clones fast.

### Required after cloning

```bash
git lfs install     # Initialize LFS on first use
git lfs pull        # Fetch the real db data (otherwise you get a few-dozen-byte pointer)
```

**Check whether a file is a pointer:** `head -c 60 references/huawei-docs.db`
— if it prints `version https://git-lfs.github.com/spec/v1`, it is a pointer.

If LFS is unavailable, rebuild from source:

```bash
node scripts/sync-huawei-docs.mjs && node scripts/build-doc-index.mjs
```

> ⚠️ GitHub's free tier includes **1 GB LFS storage + 1 GB/month bandwidth**.
> The two databases total roughly 205 MB, so one full `git lfs pull` consumes
> about 205 MB of bandwidth.

## Image Notes

Official CDN images are **signed URLs that expire in about 24 hours**
(`HW-CC-Expire=86400`). This pack preserves the original links in the Markdown body
and appends an image manifest section at the end of each document.

> **These links will expire — do not treat them as available resources.**
> Re-fetch the page when you need to view an image:

```bash
# Get fresh signed links
node scripts/fetch-huawei-doc.mjs <objectId> --catalog <catalog>

# Or download the images directly
node scripts/fetch-huawei-doc.mjs <objectId> --catalog <catalog> --images ./out
```

> Verified: stripping the signature parameters returns **403** — the images are
> **not** publicly readable object-storage URLs.

## Key Specs at a Glance

```
Corner radius (vp)  4=tags/badges  8=images/icons  16=cards  20=buttons/menus  32=sheets/dialogs
Spacing (vp)        phone horizontal margin=16  card gap=12  control gap 16/8  title-body vertical=2
Font size (fp)      Title 30/24/20(Bold)  Subtitle 18/16/14(Medium)  Body 16/14/12
Tab bar             tile 48vp / floating 56vp; icon 24×24; max container 328vp(4) / 360vp(≥5)
Title bar           single-line 56vp; emphasized 112vp; gradient blur extends 32vp below
System nav bar      bottom avoidance 28vp
Touch target        ≥48×48vp recommended, ≥40×40vp required
Material levels     5: ULTRA_THIN / THIN / REGULAR / THICK / ULTRA_THICK
Entry points        ArkUI uiMaterial = API 26.0.0; HDS hdsMaterial = 6.1.0(23)
```

Full values with official citations: [`references/design-specs.md`](references/design-specs.md).

## Three Most Common Pitfalls

1. **Material has no effect** — ordinary containers only take effect inside a Navigation
   title bar or a bottom TabBar with `barPosition: End`. Failure log:
   `Material inactive: out of scope.`
2. **Material is covered up** — once a material is set, you must not also set
   `backgroundColor` / `backgroundBlurStyle`, and must not nest materials.
   Use `Color.Transparent` to let the material show through.
3. **`systemMaterial` written before other styles** — it must come **after** all other
   style attributes, or styling breaks.

Full anti-patterns and troubleshooting table:
[`references/immersive-material/README.md`](references/immersive-material/README.md).

## Requirements

| Dependency | Version | Purpose | Required? |
|---|---|---|---|
| **Git LFS** | any recent | Pull the offline knowledge base (`.db`) | **Required to obtain the KB**; optional if you rebuild it yourself |
| **Node.js** | **≥ 22.5** | Run all scripts (built-in `fetch` + `node:sqlite`) | Required |
| **DevEco Studio** | **≥ 26.0.0** | Compile HarmonyOS apps (set `DEVECO_SDK_HOME`) | Only for HarmonyOS app development |

- **Scripts have zero third-party dependencies** — no `npm install` needed
- You can skip Git LFS entirely: omit the `.db` files and rebuild from official sources
  with `sync-*` + `build-*-index` (see [Cannot install LFS?](#cannot-install-lfs))

> `node:sqlite` is an experimental Node API. It prints an `ExperimentalWarning` to
> **stderr** on first use, which does not affect functionality or stdout output.

## License

The **scripts and hand-written documentation** in this repository (`scripts/`,
`SKILL.md`, `AGENTS.md`, `skill.yaml`, the hand-written Markdown under `references/`
excluding the `.db` files, and `skills/`) are released under the
**[GNU General Public License v3.0](LICENSE)**.

### Third-party content boundary (important)

The following is **not covered by the GPL grant**; copyright belongs to the
respective owners:

| Content | Copyright / License |
|---|---|
| `references/huawei-docs.db` | Derived from **official Huawei documentation**, copyright Huawei Technologies Co., Ltd. Distributed solely for offline retrieval |
| `references/huawei-skills.db` | Derived from the **OpenAtom Foundation** skill registry; each skill carries its own license |
| `assets/templates/base/` | From the official DevEco template; file headers state **Apache-2.0** |

Confirm compliance with the origin sites' terms before using or redistributing
the above.

## Contributing

Contributions of new sub-skill docs or spec corrections are welcome. Before submitting:

- **Cite a source for every spec value** (official URL or `file:line`)
- **Explicitly flag values with no official basis as "unverified"** — do not present
  them as specs
- Do not commit `references/huawei-docs/`, `references/huawei-skills/`, or other raw
  directories (they are already gitignored)
- Run `node scripts/verify-package.mjs` before committing

---

[简体中文](README.md) | **English**
