---
name: harmonyos-aggregate-skill
description: >-
  面向 HarmonyOS 6/7（API 20–26）的沉浸光感应用开发脚手架与规范库。提供官方
  uiMaterial / hdsMaterial 材质体系的权威用法、工程架构模板、组件与页面规范、
  华为官方设计指南与 4 万篇官方文档的本地检索。用于：新建鸿蒙工程、实现沉浸光感
  材质、搭建底部导航条/胶囊↔圆形形变、底部页签、半模态抽屉、圆形更多按钮、主题
  与外观设置（主题模式/材质档位/主题色/启动页）、深浅色适配、安全区与刘海避让、
  背景图主题、ArkTS 严格模式与 ArkUI V2 状态管理。触发词：鸿蒙、HarmonyOS、
  ArkTS、ArkUI、DevEco、沉浸光感、uiMaterial、hdsMaterial、HdsNavigation、
  HdsTabs、材质、磨砂、通透、元服务、Stage 模型。
metadata:
  version: "1.0"
  apiBaseline: "min 20 / target 26"
  upstream: "https://matrix.openharmony.cn（官方 Skill）/ developer.huawei.com（官方文档）"
---

# HarmonyOS 沉浸光感应用脚手架

面向 **HarmonyOS 6 / 7（API 20 最低、API 26 目标）** 的原生 ArkTS 应用开发技能包。
核心能力是「沉浸光感」材质体系的正确落地，以及支撑它的工程架构与页面规范。

## 核心契约

1. **先查证，再落笔。** 涉及 API 名称、枚举值、组件参数、生效范围时，必须查
   `references/immersive-material/` 或本地官方文档库，**不要凭记忆写 API**。
   官方 API 名称容易记错（`backgroundMaterial`、`HdsMaterial` 都**不存在**）。
2. **API 版本分流用设备能力判断，不用编译版本。** 必须走
   `deviceInfo.sdkApiVersion` 或 `deviceInfo.apiAvailable('26.0.0')`，
   因为工程的 `targetSdkVersion` 会高于设备实际能力。
3. **材质只有一个入口。** 页面不得内联材质参数，统一经材质工厂函数取用，
   否则外观设置无法全局生效。
4. **先读后写。** 修改现有工程前，先读其 `theme/`、`utils/PlatformCompat`、
   既有组件，沿用项目约定而非套用本文档的示例命名。
5. **验证到证据为止。** 改完 `.ets` 先静态检查再增量构建，最后真机/模拟器验证。
   构建通过 ≠ 设备验证通过。

## 资源路由

按需读取，不要一次性全加载。**优先读「分技能」目录，它们是自包含的。**

| 任务 | 读 | 说明 |
|---|---|---|
| **沉浸光感材质**（最核心） | [references/immersive-material/](references/immersive-material/) | 材质档位、API、生效范围、功耗约束、反模式 |
| **工程从零搭建 / 架构评审** | [references/project-architecture/](references/project-architecture/) | 目录分层、配置模板、路由、Service 单例、状态管理 |
| **写页面 / 组件 / 布局** | [references/components/](references/components/) | 导航条、页签、半模态、圆形按钮、列表、骨架屏 |
| **主题 / 外观设置 / 深浅色** | [references/theming/](references/theming/) | 主题模式、材质档位、主题色、启动页、背景图 |
| **安全区 / 刘海 / 状态栏** | [references/immersive-material/safe-area.md](references/immersive-material/safe-area.md) | AvoidArea API、沉浸式全屏、标题栏避让 |
| **官方设计规范数值** | [references/design-specs.md](references/design-specs.md) | 圆角/间距/字号/页签/标题栏/热区，全部带官方出处 |
| **查官方文档原文** | `scripts/search-docs.mjs` | 40,651 篇官方文档（SQLite 索引，0.4s） |
| **找官方 Skill** | `scripts/search-skills.mjs` | 144 个官方 Skill（含完整文本，可 --read 读取） |
| **更新文档 / 重建索引** | 附带技能 **[`harmonyos-docs-sync`](skills/harmonyos-docs-sync/SKILL.md)** | 同步官方文档/Skill + 重建 SQLite 索引 |
| **工程骨架** | [assets/templates/](assets/templates/) | 官方标准模板 + 沉浸光感改造件 |

### 附带技能

本包内含一个可独立安装的维护型技能：

**`harmonyos-docs-sync`** —— 文档与 Skill 的同步、索引重建、单篇抓取、图片链接刷新。

```bash
# 安装为独立技能（可选）
ln -s "$PWD/skills/harmonyos-docs-sync" ~/.claude/skills/harmonyos-docs-sync
```

**常用命令**（在包根目录执行）：

```bash
node scripts/search-docs.mjs "关键词"          # 检索 40,651 篇官方文档（0.4s）
node scripts/search-skills.mjs "关键词"        # 检索 144 个官方 Skill
node scripts/sync-huawei-docs.mjs              # 增量同步官方文档
node scripts/build-doc-index.mjs               # 重建文档索引
node scripts/fetch-huawei-doc.mjs <id> --catalog <板块>   # 刷新过期图片链接
node scripts/verify-package.mjs                # 包完整性校验
```

> 完整流程（全量重建 / 只更设计规范 / 故障排查）见
> [skills/harmonyos-docs-sync/SKILL.md](skills/harmonyos-docs-sync/SKILL.md)。

## 快速开始

### 新建一个沉浸光感应用

```
1. 读 references/project-architecture/README.md  → 取工程骨架与配置
2. 读 references/immersive-material/README.md   → 确定材质策略与 API 版本分流
3. 读 references/components/navigation.md        → 决定导航形态（底部页签 or 单页+圆形按钮）
4. 读 references/theming/README.md               → 落地外观设置三项
5. 用 assets/templates/ 作为起点，按 references 逐项替换
```

### 查一个 API 怎么用

```bash
# 全文检索官方文档（SQLite 索引，毫秒级）
node scripts/search-docs.mjs "uiMaterial 沉浸光感"
node scripts/search-docs.mjs "ImmersiveStyle" --catalog harmonyos-references
node scripts/search-docs.mjs "材质档位" --limit 30

# 读取某篇全文
node scripts/search-docs.mjs --read harmonyos-guides/arkts-immersive-light-sense-overview

# 看知识库构成
node scripts/search-docs.mjs --stats
node scripts/search-docs.mjs --catalogs
```

> 检索结果是「标题 + 路径 + 上下文档片段」。`★` 表示标题命中（优先级更高）。
> 需要看图片时用 `fetch-huawei-doc.mjs` 刷新链接（官方图片是 24h 过期签名 URL）。

### 更新知识库

```bash
# 官方文档（40,651 篇，同步约 10 分钟；重建索引约 30 分钟）
node scripts/sync-huawei-docs.mjs                           # 增量同步
node scripts/sync-huawei-docs.mjs --catalog design-guides   # 只更某板块
node scripts/build-doc-index.mjs                            # 重建 SQLite 索引
node scripts/build-doc-index.mjs --meta-only                # 只修元数据（秒级）

# 官方 Skill
node scripts/sync-huawei-skills.mjs --list                   # 看分类
node scripts/sync-huawei-skills.mjs --find arkui             # 关键词检索
node scripts/sync-huawei-skills.mjs --download --tag HMOS     # 下载某分类
node scripts/build-skill-index.mjs                           # 重建 Skill 索引（秒级）
```

> 原始 Markdown 与 Skill 目录是**本地中间产物**，已被 `.gitignore` 忽略；
> 仓库只提交构建后的 `.db`（Git LFS 管理）。详见 [README](README.md#关于仓库体积与-git-lfs)。

## 强制规范（违反即为缺陷）

这些来自官方文档与真实项目踩坑，**没有例外**：

1. **`systemMaterial` 必须放在其他样式属性之后设置**，否则样式异常（官方 FAQ）。
2. **设置材质后不要再设 `backgroundColor` / `backgroundBlurStyle` / 边框**，
   会遮挡材质。需要透出材质时用 `Color.Transparent`。
3. **沉浸光感有生效范围铁律**：普通布局容器只在
   Navigation/NavDestination 标题栏、或 `barPosition: End` 的底部 TabBar 中生效；
   其他区域仅弹窗类 / Slider / Toggle / Select 全页面生效。
   日志特征：`Material inactive: out of scope.`
4. **同一子树只在外层设一次材质**，内层不得嵌套。
5. **材质自带背景模糊**，不要再叠 `backgroundBlurStyle` / `backgroundEffect`。
6. **`colorInvert` 只对 `THIN` / `ULTRA_THIN` 生效**，且只对**资源接口**设置的颜色
   生效（硬编码 `Color.White` 不生效）。
7. **圆形按钮点击热区不得小于 40×40 vp**（官方 UX 标准「必须」级），
   推荐 48×48 vp。
8. **所有加载指示器必须显式设置品牌色**，不得使用系统默认蓝。
9. **长列表必须 `LazyForEach` + 稳定 key**，不得用 index 作 key。
10. **禁止 V1/V2 状态装饰器混用**。V2 工程只用
    `@ComponentV2 / @Local / @Param / @Event / @ObservedV2 / @Trace`；
    卡片（form）进程是唯一例外。

## 环境要求

- **Git LFS** —— 离线知识库（`.db`，约 205 MB）由 Git LFS 托管。
  未安装时克隆到的只是**指针文件**，检索会失败。修复：
  `git lfs install && git lfs pull`，或用 `sync-*` + `build-*-index` 自行重建。
  **先跑 `node scripts/search-docs.mjs --stats` 确认条目数为 40651。**
- **Node.js ≥ 22.5** —— 脚本依赖内置 `fetch` 与 `node:sqlite`（后者是实验性 API，
  首次使用会向 **stderr** 打印 `ExperimentalWarning`，不影响 stdout 的检索结果）。
- 开发鸿蒙应用需 **DevEco Studio 26.0.0+**（API 26 沉浸光感）并设置 `DEVECO_SDK_HOME`。
- 目标设备：phone（多设备形态见 `references/design-specs.md`）。
- 脚本**零第三方依赖** —— 不需要 `npm install`。

## 免责与来源

- 官方文档与 Skill 版权归华为 / 开放原子基金会所有，本包仅为**本地检索副本**，
  使用须遵守原站条款。`robots.txt` 声明 `ai-input=yes`。
- 所有规范数值均标注官方出处；**未找到官方依据的数值会显式标记「未证实」**，
  不要把它当作规范使用。
