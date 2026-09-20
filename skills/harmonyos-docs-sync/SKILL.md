---
name: harmonyos-docs-sync
description: >-
  同步华为官方 HarmonyOS 文档与官方 Skill，并重建本地 SQLite 检索索引。
  用于：更新离线知识库、重建全文索引、抓取单篇官方文档、刷新过期图片链接、
  批量下载官方 Skill、检索官方文档原文。触发词：更新文档、同步文档、重建索引、
  更新知识库、华为文档、官方文档检索、官方 skill 下载、索引过期、docs sync。
metadata:
  version: "1.0"
  parentSkill: harmonyos-aggregate-skill
  requires: Node.js >= 22.5
---

# HarmonyOS 文档同步与索引

维护 [harmonyos-aggregate-skill](../..) 的离线知识库：**下载官方内容 → 转 Markdown →
构建 SQLite 全文索引**。

## 何时用

| 场景 | 动作 |
|---|---|
| 知识库缺失/未就位（克隆后没跑过 `git lfs pull`） | 全量同步 + 构建 |
| 官方文档有更新，想拿最新内容 | **增量同步**（已存在的跳过） |
| 只关心设计规范改版 | 只同步 `design-guides` 板块 |
| 检索结果不对/索引损坏 | 重建索引 |
| 需要看某篇官方文档 | 单篇抓取 |
| 归档文档里的图片链接失效 | 刷新图片链接 |

## 目录约定

```
<skill-root>/
├── references/
│   ├── huawei-docs/          # 原始 Markdown（中间产物，不入库）
│   ├── huawei-docs.db        # ← 文档全文索引（提交，Git LFS）
│   ├── huawei-skills/        # 原始 Skill 目录（中间产物，不入库）
│   └── huawei-skills.db      # ← Skill 索引（提交，Git LFS）
└── scripts/
    ├── sync-huawei-docs.mjs      同步文档
    ├── build-doc-index.mjs       构建文档索引
    ├── search-docs.mjs           文档检索
    ├── sync-huawei-skills.mjs    同步 Skill
    ├── build-skill-index.mjs     构建 Skill 索引
    ├── search-skills.mjs         Skill 检索
    ├── fetch-huawei-doc.mjs      单篇抓取
    └── lib/tokenize.mjs          分词（索引与查询共用，**勿复制**）
```

所有命令在**技能包根目录**执行。

## 一、完整重建（克隆后或索引丢失）

```bash
# 0) 若 db 是 LFS 指针文件（几十字节的文本），先拉真实数据
git lfs pull

# 若 LFS 不可用，则从零重建：
node scripts/sync-huawei-docs.mjs     # 40,651 篇，约 10 分钟 / 276 MB
node scripts/build-doc-index.mjs      # 约 30 分钟 → 172 MB db

node scripts/sync-huawei-skills.mjs --download --tag HMOS   # 按需，可换分类
node scripts/build-skill-index.mjs    # 约 30 秒 → 32 MB db
```

> 判断 db 是否为指针：`head -c 100 references/huawei-docs.db` —— 若输出
> `version https://git-lfs.github.com/spec/v1` 就是指针。

## 二、日常增量更新

```bash
# 文档：已存在的文件默认跳过，只抓新增
node scripts/sync-huawei-docs.mjs

# 重建索引（正文 gzip 压缩，可原地重建）
node scripts/build-doc-index.mjs
```

**只更新设计规范**（166 篇，秒级同步）：

```bash
node scripts/sync-huawei-docs.mjs --catalog design-guides
node scripts/build-doc-index.mjs --meta-only   # 只修元数据，不重建全文索引
```

> ⚠️ `--meta-only` **只更新元数据字段**（标题/更新时间/来源），
> **不更新正文与索引**。正文有改动时必须跑完整 `build-doc-index.mjs`。

## 三、检索

```bash
# 文档
node scripts/search-docs.mjs "沉浸光感"
node scripts/search-docs.mjs "材质档位" --catalog harmonyos-guides
node scripts/search-docs.mjs "ImmersiveStyle" --any --limit 30
node scripts/search-docs.mjs --read harmonyos-guides/arkts-immersive-light-sense-overview
node scripts/search-docs.mjs --stats
node scripts/search-docs.mjs --catalogs

# Skill
node scripts/search-skills.mjs "arkui 状态管理"
node scripts/search-skills.mjs --list
node scripts/search-skills.mjs --read hmos-arkui-develop-skill
```

**检索语法**：

| 用法 | 含义 |
|---|---|
| `"材质" "档位"` | 多关键词 **AND** |
| `--any` | 改为 **OR** |
| `--catalog <板块>` | 限定板块 |
| `--limit <n>` | 结果条数（默认 20） |
| `--context <n>` | 片段上下文行数（默认 2） |
| `--title-only` | 只搜标题 |
| `--json` | 机器可读输出 |

> `★` 标记表示**标题命中**（已做标题加权重排）。

## 四、单篇抓取与图片刷新

官方 CDN 图片是**签名 URL，约 24 小时过期**。归档 Markdown 里保留的是旧链接。

```bash
# 拿新鲜链接
node scripts/fetch-huawei-doc.mjs <objectId> --catalog <板块>

# 列图片直链
node scripts/fetch-huawei-doc.mjs <objectId> --catalog design-guides --list-images

# 下载图片
node scripts/fetch-huawei-doc.mjs <objectId> --catalog design-guides --images ./out

# 刷新归档文件里的链接
node scripts/fetch-huawei-doc.mjs <objectId> --catalog design-guides --write
```

`objectId` 就是官方 URL 的最后一段：

```
https://developer.huawei.com/consumer/cn/doc/design-guides/corner-radius-parameter-0000002556468705
                                                    └── 板块 ──┘ └──────── objectId ────────┘
```

## 五、官方 Skill

```bash
node scripts/sync-huawei-skills.mjs --list                    # 17 个分类
node scripts/sync-huawei-skills.mjs --find arkui              # 关键词检索（不下载）
node scripts/sync-huawei-skills.mjs --download --tag HMOS     # 下载某分类
node scripts/sync-huawei-skills.mjs --download --find 性能     # 下载搜索结果
node scripts/build-skill-index.mjs                            # 重建索引

# 装到本地代理（需 DevEco CLI）
devecocli skills add --skill <name> --agent claude-code
```

**分类与规模**（实测）：

| 分类 | 数量 | 说明 |
|---|---|---|
| 鸿蒙PC | 2314 | ⚠️ **泛分类**，多为与鸿蒙无关的通用 skill |
| OpenHarmony | 98 | |
| HMOS | 49 | 含 Kit 接入、性能分析、设计视觉 |
| ArkTS / ArkUI | 21 / 14 | 状态管理、语法检查、知识检索 |
| 鸿蒙开放能力 | 12 | |
| DevEco / DFX / ASCF / 性能库 | 8 / 7 / 4 / 6 | |

> 全站注册 4,130 个，其中鸿蒙相关约 200 个。**不要盲目 `--all`**。

## 六、故障排查

| 症状 | 原因与解法 |
|---|---|
| `未找到索引数据库` | 索引未构建，跑 `build-doc-index.mjs` |
| db 是几十字节文本 | LFS 指针，跑 `git lfs pull` |
| 检索中文无结果 | **索引与查询的分词必须一致** —— 检查是否用了 `scripts/lib/tokenize.mjs`，不要自己实现 |
| 同步大面积失败 | 官方限流，降低并发 `--concurrency 4`，脚本自带指数退避重试 |
| `ExperimentalWarning: SQLite` | 正常现象（Node 实验性 API），只影响 stderr，不影响结果 |
| 图片 403 | 签名过期，用 `fetch-huawei-doc.mjs` 重新拉取该页 |
| 技能下载 `terminated` | 单个 Skill 过大被中断，重跑同一命令即可续传 |

## 数据来源

| 内容 | 来源 | 接口 |
|---|---|---|
| 官方文档 | `developer.huawei.com` 文档中心 | `POST .../documentPortal/getDocumentById`<br>URL 清单来自 `/consumer/cn/sitemap/doc/sitemap1.xml` |
| 官方 Skill | 开放原子 `matrix.openharmony.cn` | `POST /api/registry/skill/skills`<br>`GET /api/registry/skill/{name}/install?format=zip` |
| DevEco 工具链文档 | npm `@deveco/deveco-cli` 的 `docs.zip` | — |

> 站点 `robots.txt` 声明 `Content-Signal: ai-input=yes`。
> 内容版权归华为 / 开放原子基金会所有，本知识库仅供**本地检索与学习**。

## 关键约束

1. **分词逻辑必须单一来源** —— `scripts/lib/tokenize.mjs` 被索引与查询共用。
   在任一侧复制粘贴会导致索引与查询串不匹配、**检索静默失效**。
2. **不要提交原始中间产物** —— `references/huawei-docs/`、`references/huawei-skills/`
   共 4 万+ 文件，已被 `.gitignore` 忽略。只提交 `.db`（Git LFS）。
3. **重建索引是原子操作** —— 写入 `<db>.building` 临时文件，成功后替换。
   构建期间旧索引始终可用，中断不留半成品。
4. **正文以 gzip BLOB 存储** —— 压缩到源码的约 63%。查询脚本会自动解压，
   同时兼容早期未压缩的 TEXT 存储。

## 完成后自检

```bash
node scripts/verify-package.mjs
```
会校验：`skill.yaml` 引用有效性、Markdown 链接、知识库条目数与体积、
`.gitignore`/`.gitattributes` 覆盖、YAML 语法。

## 相关

- 主技能（沉浸光感开发） → [../../SKILL.md](../../SKILL.md)
- 代理协作指南 → [../../AGENTS.md](../../AGENTS.md)
