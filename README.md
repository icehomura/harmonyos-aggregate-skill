# HarmonyOS 聚合 Skill

> 面向 **HarmonyOS 6 / 7（API 20 – 26）** 的原生 ArkTS 应用开发技能包 + 离线官方知识库。
>
> [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
> [![Docs](https://img.shields.io/badge/官方文档-40651_篇-green.svg)](#知识库与数据来源)
> [![Skills](https://img.shields.io/badge/官方_Skill-144_个-green.svg)](#二官方-skill-144-个)
> [![Node](https://img.shields.io/badge/Node.js-%E2%89%A5%2022.5-brightgreen.svg)](#环境要求)
> [![Git LFS](https://img.shields.io/badge/Git%20LFS-%E5%BF%85%E8%A3%85-orange.svg)](#%EF%B8%8F-克隆前必读必须安装-git-lfs)

> **简体中文** | [English](README.en.md)

> [!IMPORTANT]
> **克隆前请先安装 [Git LFS](https://git-lfs.com)** —— 离线知识库（约 205 MB）由 LFS 托管，
> 未安装时克隆到的只是**指针文件**，检索会失败。
> 安装方式见下方 [⚠️ 克隆前必读](#%EF%B8%8F-克隆前必读必须安装-git-lfs)。

> 一个**聚合型**鸿蒙开发技能包：把散落在 4 万+ 篇官方文档里的权威依据、官方设计规范数值、
> 工程骨架模板与官方 Skill 收敛到一处，并内置**可离线毫秒级查询的 SQLite 知识库**。

核心覆盖 **沉浸光感（Immersive Light Sense）材质体系** —— 这是 HarmonyOS 7 视觉升级的基石，
也是官方 API 名称最容易被记错的部分（`backgroundMaterial`、`HdsMaterial` 都**不存在**）。

## 它解决什么问题

| 痛点 | 本包的做法 |
|---|---|
| 官方 API 名称、枚举、参数极易记错 | `references/immersive-material/` 逐条列出**正确名称 + 常见误记对照** |
| 材质设了不生效，不知为什么 | 明确「**生效范围铁律**」+ 失效日志特征 + 故障对照表 |
| 设计数值（圆角/间距/字号）查不到 | `references/design-specs.md` 全部数值**带官方出处**，未证实的显式标注 |
| 4 万篇官方文档无法离线检索 | 内置 SQLite 全文索引，**0.4 秒**响应 |
| 官方 Skill 分散、难以发现 | 144 个官方 Skill 已索引，可检索、可读全文、可一键安装 |
| 从零搭工程配置繁琐 | `assets/templates/` 提供官方骨架 + 沉浸光感改造件 |
| 官方文档会更新 | 一条命令**增量同步 + 重建索引**（见 [附带技能](#附带技能harmonyos-docs-sync)） |

## ⚠️ 克隆前必读：必须安装 Git LFS

> **本仓库的离线知识库（约 205 MB）通过 [Git LFS](https://git-lfs.com) 管理。**
> 它**不在**普通 git 对象里 —— 没有 LFS 时你拿到的只是一份 133 字节的**指针文本**，
> 检索会直接报错。

### 1. 先装 Git LFS（**克隆之前**）

```bash
# macOS
brew install git-lfs

# Windows（三选一）
winget install GitHub.GitLFS
scoop install git-lfs
choco install git-lfs

# Ubuntu / Debian
sudo apt install git-lfs

# Fedora / RHEL
sudo dnf install git-lfs

# 其他平台或手动安装：https://git-lfs.com
```

### 2. 启用（每台机器一次）

```bash
git lfs install
```

### 3. 再克隆

```bash
git clone https://github.com/icehomura/harmonyos-aggregate-skill.git \
  ~/.claude/skills/harmonyos-aggregate-skill

# 若克隆时跳过了 LFS（如 --skip-smudge），或拿到的是指针文件，手动拉取：
cd ~/.claude/skills/harmonyos-aggregate-skill && git lfs pull
```

### 如何确认拿到的是真实数据

```bash
head -c 60 references/huawei-docs.db
# ✓ 二进制乱码            → 正常，是真实数据库
# ✗ version https://...  → 还是指针，跑 `git lfs pull`
```

### 装不了 LFS 怎么办

可以不依赖 LFS，**从官方源自行重建**知识库（需要联网，约 40 分钟）：

```bash
node scripts/sync-huawei-docs.mjs     # 同步 40,651 篇官方文档（约 10 分钟）
node scripts/build-doc-index.mjs      # 重建索引（约 30 分钟）
```

> 详见 [关于仓库体积与 Git LFS](#关于仓库体积与-git-lfs)。

---

## 快速开始

### 作为 AI 技能使用

```bash
git clone https://github.com/icehomura/harmonyos-aggregate-skill.git \
  ~/.claude/skills/harmonyos-aggregate-skill
```

代理会在遇到鸿蒙 / ArkTS / 沉浸光感相关任务时自动加载。

### 查询知识库

```bash
# 官方文档（40,651 篇）
node scripts/search-docs.mjs "沉浸光感"
node scripts/search-docs.mjs "材质档位" --catalog harmonyos-guides
node scripts/search-docs.mjs --read harmonyos-guides/arkts-immersive-light-sense-overview
node scripts/search-docs.mjs --stats

# 官方 Skill（144 个）
node scripts/search-skills.mjs "arkui 状态管理"
node scripts/search-skills.mjs --list
node scripts/search-skills.mjs --read hmos-arkui-develop-skill
```

### 更新知识库

```bash
node scripts/sync-huawei-docs.mjs     # 增量同步官方文档（约 10 分钟）
node scripts/build-doc-index.mjs      # 重建索引（约 30 分钟 → 172 MB）

node scripts/sync-huawei-skills.mjs --download --tag HMOS   # 同步官方 Skill
node scripts/build-skill-index.mjs                          # 重建索引（约 30 秒）
```

> 完整用法（含只更设计规范、图片刷新、故障排查）见
> [附带技能 harmonyos-docs-sync](skills/harmonyos-docs-sync/SKILL.md)。

## 目录结构

```
.
├── SKILL.md                          主技能入口（AI 触发的唯一入口）
├── AGENTS.md                         代理协作指南（工作流、硬约束）
├── skill.yaml                        包结构、懒加载路由、同步机制（YAML）
├── LICENSE                           GPL-3.0
│
├── references/
│   ├── immersive-material/          ★ 沉浸光感材质（最核心）
│   │   ├── README.md                 档位模型、API、生效范围、功耗 8 条、反模式
│   │   └── safe-area.md              安全区 / 刘海 / 状态栏避让
│   ├── project-architecture/         目录分层、配置全文、路由、Service、ArkUI V2
│   ├── components/                  ★ 组件实现
│   │   ├── navigation.md             底部导航条、胶囊↔圆形形变、MiniBar
│   │   ├── sheet.md                  半模态抽屉、抽屉内子组件规范
│   │   ├── circle-button.md          圆形按钮、更多菜单
│   │   └── lists.md                  列表 / 网格 / 骨架屏 / 下拉刷新
│   ├── theming/                     ★ 主题与外观
│   │   ├── README.md                 主题模式 / 材质 6 档 / 主题色 / 启动页
│   │   └── background-image.md       自定义背景图（蒙层 / 模糊 / 暗度）
│   ├── design-specs.md              ★ 官方设计规范数值（全部带出处）
│   │
│   ├── huawei-docs.db               ← 40,651 篇文档全文索引（172 MB，Git LFS）
│   └── huawei-skills.db             ← 144 个 Skill 索引（32 MB，Git LFS）
│
├── assets/templates/
│   ├── base/                        DevEco 官方标准工程骨架（25 个文件）
│   └── immersive/                   沉浸光感改造件（3 个可复制文件）
│
├── skills/
│   └── harmonyos-docs-sync/        ← 附带技能：文档同步与索引重建
│       └── SKILL.md
│
└── scripts/                         零第三方依赖（仅用 Node 内置模块）
    ├── lib/tokenize.mjs             中英文预分词（索引与查询共用，勿复制）
    ├── sync-huawei-docs.mjs         同步官方文档
    ├── build-doc-index.mjs          构建文档 SQLite 索引
    ├── search-docs.mjs              文档检索 / 读全文 / 统计
    ├── sync-huawei-skills.mjs       同步官方 Skill
    ├── build-skill-index.mjs        构建 Skill SQLite 索引
    ├── search-skills.mjs            Skill 检索 / 读内容
    ├── fetch-huawei-doc.mjs         单篇抓取（刷新过期图片链接）
    └── verify-package.mjs           包完整性校验
```

## 知识库与数据来源

本包内置两个**离线检索副本**。原始内容版权归原作者，此处仅为方便离线查询与 AI 调用。

### 一、官方文档（40,651 篇）

| 项 | 说明 |
|---|---|
| **来源** | 华为开发者联盟文档中心 `developer.huawei.com/consumer/cn/doc/` |
| **URL 清单** | 官方 sitemap：`/consumer/cn/sitemap/doc/sitemap1.xml` |
| **内容接口** | `POST svc-drcn.developer.huawei.com/.../documentPortal/getDocumentById`<br>body：`{ objectId, catalogName, language: 'cn' }` |
| **获取方式** | 纯 HTTP（**非网页抓取** —— 该站是 SPA，直接 curl 只能拿到空壳） |
| **规模** | 40,651 篇 / 91 个板块 / 源 Markdown 275.8 MB → 索引 172.8 MB |
| **正文编码** | gzip BLOB（压缩至源码的约 63%） |

**板块构成**（前 6）：

| 数量 | 板块 | 内容 |
|---|---|---|
| 5,721 | `harmonyos-guides` | 开发指南 |
| 4,762 | `harmonyos-references` | **组件与 API 参考** |
| 4,595 | `harmonyos-faqs` | 常见问题 |
| 2,408 | `HMSCore-References` | HMS Core API |
| 2,364 | `AppGallery-connect-Guides` | 应用市场接入 |
| 166 | `design-guides` | **官方设计指南**（本包规范数值的主要依据） |

### 二、官方 Skill（144 个）

| 项 | 说明 |
|---|---|
| **来源** | 开放原子 OpenHarmony Matrix 平台 `matrix.openharmony.cn`<br>（即 DevEco CLI `devecocli skills` 的同一后端） |
| **检索接口** | `POST /api/registry/skill/skills`，body：`{ pageNum, pageSize, tagIds[], keyword }` |
| **下载接口** | `GET /api/registry/skill/{name}/install?format=zip` → 302 → 华为 OBS |
| **完整性校验** | `GET /api/registry/skill/{name}/checksum`（sha256 + size） |
| **规模** | 全站注册 4,130 个，其中鸿蒙相关约 200 个；本包收录 **144 个 / 7,538 个文件** |

**收录分类**：`HMOS`(41) · `OpenHarmony`(90) · `ArkTS`(16) · `ArkUI` · `鸿蒙开放能力`(12) ·
`DFX`(7) · `ASCF`(4) · `OpenHarmony性能技能库`

> ⚠️ 官方的 `鸿蒙PC` 分类虽有 2,314 个条目，但属**泛分类**（含 `find-skills`、
> `data-analysis`、`legal-advisor` 等与鸿蒙无关的通用 skill），**未收录**。

### 三、DevEco 工具链文档

来源：npm 包 `@deveco/deveco-cli` 内置的 `docs.zip`（含 31,477 个文件、
官方工程模板与 `search.db` 全站搜索库）。

### 四、工程模板

`assets/templates/base/` 取自 `@deveco/deveco-cli` 的**官方工程模板**（25 个文件），
文件头标注 Apache-2.0。

### 合规说明

- 华为文档站的 `robots.txt` 声明 `Content-Signal: ai-train=yes, search=yes, ai-input=yes`
- 本包**仅做本地检索副本**，不修改原文、不用于商业再分发
- 再分发这些内容前请自行确认符合原站条款

## 附带技能：harmonyos-docs-sync

**技能名：`harmonyos-docs-sync`** —— 负责知识库的同步与索引重建。

| 用途 | 命令 |
|---|---|
| 全量重建（克隆后 / 索引丢失） | `sync-huawei-docs.mjs` → `build-doc-index.mjs` |
| 日常增量更新 | `sync-huawei-docs.mjs` → `build-doc-index.mjs` |
| 只更新设计规范（166 篇，秒级） | `sync-huawei-docs.mjs --catalog design-guides` |
| 官方 Skill 同步 | `sync-huawei-skills.mjs --download --tag <分类>` |
| 单篇抓取 / 刷新过期图片链接 | `fetch-huawei-doc.mjs <objectId> --catalog <板块>` |
| 包完整性校验 | `verify-package.mjs` |

**安装为独立技能**（可选，便于只做文档维护时使用）：

```bash
ln -s "$PWD/skills/harmonyos-docs-sync" ~/.claude/skills/harmonyos-docs-sync
```

完整说明见 [skills/harmonyos-docs-sync/SKILL.md](skills/harmonyos-docs-sync/SKILL.md)。

## 关于仓库体积与 Git LFS

### 为什么不提交那 4 万个 Markdown

直接把原始文件提交会造成严重**碎片化**：每个文件一个 blob + tree entry，
clone 极慢、diff 与 code review 不可读。因此：

- **原始 Markdown / Skill 目录** → `.gitignore` 忽略，作为**本地构建中间产物**
- **SQLite 索引** → 提交，由 **Git LFS** 管理（单文件）

这样仓库**只有 50 余个被追踪文件**，克隆体验正常。

### 克隆后必做

```bash
git lfs install     # 首次使用 LFS 需初始化
git lfs pull        # 拉取 db 真实数据（否则只有几十字节的指针文件）
```

**判断是否为指针**：`head -c 60 references/huawei-docs.db`
—— 若输出 `version https://git-lfs.github.com/spec/v1` 即为指针。

未安装 LFS 时可自行重建：

```bash
node scripts/sync-huawei-docs.mjs && node scripts/build-doc-index.mjs
```

> ⚠️ GitHub 免费账户 LFS 额度为 **1 GB 存储 + 1 GB/月流量**。
> 两个 db 合计约 205 MB，一次完整 `git lfs pull` 消耗约 205 MB 流量。

## 图片说明

官方 CDN 图片是**签名 URL，约 24 小时过期**（`HW-CC-Expire=86400`）。
本包在 Markdown 正文中保留原始链接，并在文末附「图片清单」段。

> **这些链接会过期，不要当作可用资源。** 需要查看时重新拉取该页：

```bash
# 拿新鲜签名链接
node scripts/fetch-huawei-doc.mjs <objectId> --catalog <板块>

# 或直接下载图片
node scripts/fetch-huawei-doc.mjs <objectId> --catalog <板块> --images ./out
```

> 实测：去掉签名参数后返回 **403**，图片**不是**公开可读的对象存储地址。

## 关键规范速览

```
圆角(vp)   4=标签/角标  8=图片/图标  16=卡片  20=按钮/菜单  32=半模态/弹窗
间距(vp)   手机左右 margin=16  卡片间=12  控件间 16/8  主次文本上下=2
字号(fp)   Title 30/24/20(Bold)  Subtitle 18/16/14(Medium)  Body 16/14/12
页签       平铺 48vp / 悬浮 56vp；图标 24×24；容器最大 328vp(4个) / 360vp(≥5个)
标题栏     单行 56vp；强调型 112vp；渐变模糊层高于底边 32vp
导航条     底部抬高避让 28vp
热区       ≥48×48vp 推荐，≥40×40vp 必须
材质       5 档 ULTRA_THIN / THIN / REGULAR / THICK / ULTRA_THICK
入口       ArkUI uiMaterial = API 26.0.0；HDS hdsMaterial = 6.1.0(23)
```

完整数值与官方出处见 [`references/design-specs.md`](references/design-specs.md)。

## 三条最容易踩的坑

1. **材质不生效** —— 普通容器只在 Navigation 标题栏 / `barPosition: End` 的底部 TabBar
   中生效。失效日志：`Material inactive: out of scope.`
2. **材质被盖住** —— 设了材质就不能再设 `backgroundColor` / `backgroundBlurStyle`，
   也不能嵌套。用 `Color.Transparent` 透出。
3. **`systemMaterial` 写在样式前面** —— 必须放在其他样式属性**之后**，否则样式异常。

完整反模式与故障对照见
[`references/immersive-material/README.md`](references/immersive-material/README.md)。

## 环境要求

| 依赖 | 版本 | 用途 | 必需性 |
|---|---|---|---|
| **Git LFS** | 任意较新版本 | 拉取离线知识库（`.db`） | **获取知识库必需**；若自行重建则可省 |
| **Node.js** | **≥ 22.5** | 运行全部脚本（内置 `fetch` + `node:sqlite`） | 必需 |
| **DevEco Studio** | **≥ 26.0.0** | 编译鸿蒙应用（需设 `DEVECO_SDK_HOME`） | 仅开发鸿蒙应用时需要 |

- **脚本零第三方依赖**，无需 `npm install`
- 不装 Git LFS 也可以：跳过 `.db`，用 `sync-*` + `build-*-index` 从官方源自行重建
  （见 [装不了 LFS 怎么办](#装不了-lfs-怎么办)）

> `node:sqlite` 是 Node 的实验性 API，首次调用会向 **stderr** 打印
> `ExperimentalWarning`，不影响功能与 stdout 输出。

## 许可

本仓库的**脚本与手写文档**（`scripts/`、`SKILL.md`、`AGENTS.md`、`skill.yaml`、
`references/` 下除 `.db` 外的手写 Markdown、`skills/`）采用
**[GNU General Public License v3.0](LICENSE)** 开源。

### 第三方内容边界（重要）

以下内容**不属于 GPL 授权范围**，版权归各自所有者：

| 内容 | 版权 / 许可 |
|---|---|
| `references/huawei-docs.db` | 派生自**华为官方文档**，版权归华为技术有限公司。仅为离线检索目的分发 |
| `references/huawei-skills.db` | 派生自**开放原子基金会** Skill 仓库，各 Skill 自带许可 |
| `assets/templates/base/` | 取自 DevEco 官方模板，文件头标注 **Apache-2.0** |

使用、再分发上述内容前，请自行确认符合原站条款。

## 贡献

欢迎补充分技能文档或修正数值。提交前请确保：

- 所有规范数值**标注出处**（官方 URL 或 `文件:行号`）
- 未找到官方依据的数值**显式标注「未证实」**，不要包装成规范
- 不要提交 `references/huawei-docs/`、`references/huawei-skills/` 等原始目录
  （已在 `.gitignore`）
- 提交前跑一次 `node scripts/verify-package.mjs`

---

[English](README.en.md) · **简体中文**
