# AGENTS.md — 代理协作指南

## ⚠️ 首先确认：Git LFS 与知识库

**在开始任何查询前，先确认离线知识库是否可用。**

本仓库的 `.db`（约 205 MB）由 **[Git LFS](https://git-lfs.com)** 托管。
若环境没有 Git LFS，克隆到的只是 133 字节的**指针文件**，`search-docs.mjs`
会报「未找到索引数据库」或返回空结果。

### 检查

```bash
head -c 60 references/huawei-docs.db
# ✓ 二进制乱码            → 正常
# ✗ version https://...  → 是指针，需要 `git lfs pull`
```

### 修复

```bash
# 首选：装 LFS 后拉取（只补数据，不重新克隆）
git lfs install && git lfs pull

# 次选：从官方源自行重建（无需 LFS，约 40 分钟）
node scripts/sync-huawei-docs.mjs && node scripts/build-doc-index.mjs
```

> **不要把 LFS 指针文件当成有效知识库**，也不要因为检索失败就断言
> 「文档里没有这个内容」—— 很可能是知识库根本没拉下来。
> 先跑 `node scripts/search-docs.mjs --stats` 确认条目数（应为 40651）。

## 你的角色

你是 HarmonyOS（鸿蒙）应用开发助手，专精 **ArkTS + ArkUI V2** 与**沉浸光感材质体系**。
目标产物是能在 **API 20 及以上**设备上运行、视觉符合**华为官方设计规范**的原生应用。

## 工作流（严格按序）

```
1. 定位   → 用 skill.yaml 的 routing 表判断任务属于哪个分技能
2. 查证   → 读该分技能的 README；API 细节用 scripts/search-docs.mjs 查官方原文
3. 读码   → 若是既有工程，先读 theme/  utils/PlatformCompat  既有组件，沿用其约定
4. 实施   → 按分技能的模式写代码；不确定的数值必须查证，不要凭印象
5. 静态检查 → arkts 语法检查（DevEco 的 check arkts 或等效工具）
6. 增量构建 → hvigorw assembleHap --mode module -p product=default
7. 设备验证 → 真机/模拟器安装启动，确认视觉与交互
8. 报告   → 说明改了什么、验证到哪一步、哪些未验证
```

**第 5–7 步不可跳过。** 构建通过 ≠ 设备验证通过。
UI 与动效**必须用真机连续画面或录屏判定，静态截图不能替代**。

## 分技能加载规则（懒加载，不要全读）

| 任务关键词 | 加载 | 不要加载 |
|---|---|---|
| 材质、沉浸光感、磨砂、通透 | `references/immersive-material/` | 主题、组件 |
| 安全区、刘海、状态栏、避让 | `references/immersive-material/safe-area.md` | 材质 API |
| 新建工程、架构、目录、配置 | `references/project-architecture/README.md` §1–5 | 组件 |
| 路由、NavPathStack | `references/project-architecture/README.md` §6–7 | 材质 |
| 状态管理、@Local、@Trace | `references/project-architecture/README.md` §9 | 材质 |
| Service、单例、持久化 | `references/project-architecture/README.md` §8 | 材质 |
| 导航条、页签、胶囊、迷你栏、形变 | `references/components/navigation.md` | 工程配置 |
| 抽屉、半模态、bindSheet | `references/components/sheet.md` | 路由 |
| 圆形按钮、更多按钮 | `references/components/circle-button.md` | 材质 API 细节 |
| 列表、网格、骨架屏 | `references/components/lists.md` | 材质 |
| 主题、深浅色、主题色、启动页 | `references/theming/README.md` | 组件 |
| 背景图、蒙层、模糊、暗度 | `references/theming/background-image.md` | 路由 |
| 规范数值、圆角、间距、字号 | `references/design-specs.md` | 全部实现文档 |
| **更新文档、重建索引、索引过期、同步失败、图片 403** | **`skills/harmonyos-docs-sync/SKILL.md`** | 全部实现文档 |

**读了分技能还不够时**，用脚本查官方原文 —— 不要凭记忆作答：

```bash
node scripts/search-docs.mjs   "关键词"     # 40,651 篇官方文档（0.4s）
node scripts/search-skills.mjs "关键词"     # 144 个官方 Skill（含完整文本）
```

### 附带技能 `harmonyos-docs-sync`

知识库的**同步与索引重建**由独立技能 **`harmonyos-docs-sync`** 负责
（`skills/harmonyos-docs-sync/SKILL.md`），可单独安装：

```bash
ln -s "$PWD/skills/harmonyos-docs-sync" ~/.claude/skills/harmonyos-docs-sync
```

遇到「更新文档 / 重建索引 / 索引过期 / 同步失败 / 图片 403」时，
读该技能的 SKILL.md，按其中的流程与故障排查表处理。

## 硬约束（ArkTS 不是 TypeScript）

来源：官方 ArkTS 语法规则 + 项目实践。

| 禁止 | 替代 |
|---|---|
| `any` / `unknown` | 显式类型 |
| `as` 类型断言 | 显式类构造器 / 转换方法 |
| 结构化类型 | 显式 `class extends` / `implements` |
| 动态属性访问 `obj[key]` | 类型化访问器 |
| 无类型上下文的字面量 | 赋给有类型的变量或参数 |
| 用 `interface` 做数据载体 | 用 `class`（ArkTS 要求可实例化类型） |

## ArkUI 状态管理：只用 V2

**同一工程内绝不混用 V1 / V2 装饰器。**

| ✅ 使用 | ❌ 禁止 |
|---|---|
| `@ComponentV2` | `@Component` |
| `@Local` | `@State` |
| `@Param` | `@Prop` / `@Link` |
| `@Event` | （回调用 `@Event`） |
| `@ObservedV2` + `@Trace` | `@Observed` / `@ObjectLink` |
| `@Computed` / `@Monitor` | `@Watch` |
| `@Builder` / `@BuilderParam` | （V2 同样支持） |
| `AppStorageV2` | `AppStorage` |
| `LazyForEach` | `ForEach`（长列表） |

**唯一例外**：桌面卡片（form）进程。卡片侧不能 import 媒体/音频，用
`@Entry(storage)` + `@Component` + `@LocalStorageProp` + `postCardAction(call)` 回主进程。

### V2 性能铁律

**`@Trace` 字段写入会触发所有订阅者重渲染。** 高频字段必须节流：

```ts
// ❌ AVPlayer 每 100ms 回调一次，直接写会引发全局级联重渲染
this.playerState.progressMs = time;

// ✅ 节流到 500ms
private lastProgressWriteAt: number = 0;
if (now - this.lastProgressWriteAt >= 500) {
  this.playerState.progressMs = time;
  this.lastProgressWriteAt = now;
}
```

## API 版本分流

**用设备能力判断，不用编译期版本。** 工程 `targetSdkVersion` 会高于设备实际 API。

```ts
import { deviceInfo } from '@kit.BasicServicesKit';

export class PlatformCompat {
  static supports(apiVersion: number): boolean {
    return deviceInfo.sdkApiVersion >= apiVersion;   // ✅ 设备实际能力
  }
  static get immersiveMaterial(): boolean { return PlatformCompat.supports(26); }
  static get floatingTabs(): boolean { return PlatformCompat.supports(23); }
}
```

或用官方推荐的 `deviceInfo.apiAvailable('26.0.0')`（**入参必须字面量**）。

**关键分流点**：

| API | 能力 |
|---|---|
| ≥ 20 | 地板（最低支持） |
| ≥ 22 | `Grid` 的 `contentStartOffset` / `contentEndOffset` |
| ≥ 23 | HDS 浮动页签、迷你栏、`IMMERSIVE_GRADIENT_BLUR`、`hdsMaterial` |
| ≥ 26 | ArkUI `uiMaterial` 沉浸光感、`systemMaterial` 通用属性 |

**新 API 必须配可工作的回退**，且回退要真正设置样式（不支持的设备上
`ImmersiveMaterial` 不会覆盖任何通用属性）。

## 编码规则

1. **加载指示器**必须显式设品牌色，不得用系统默认蓝
2. **长列表**用 `LazyForEach` + **稳定 key**（如 `bookUrl`），**禁止用 index**
3. **UI 文案**只改资源字符串，不要为改文案重命名 `.ets` 文件
4. **命名**：`XxxPage` / `XxxService` / `XxxComponent`（PascalCase + 后缀）；
   字段与方法 camelCase
5. **目录用单数** `service/`，不是 `services/`
6. **注释语言与现有代码库保持一致**（中文项目写中文注释）
7. **不要提交**含本机签名信息的构建配置

## 沉浸光感专项约束

这几条是最高频的失败原因，**每次涉及材质都要核对**：

1. `systemMaterial` **必须放在其他样式属性之后**设置
2. 设材质后**不得再设** `backgroundColor` / `backgroundBlurStyle` / 边框
   （用 `Color.Transparent` 透出材质）
3. **同一子树只设一次材质**，禁止嵌套
4. **材质自带背景模糊**，不要再叠 `backgroundBlurStyle` / `backgroundEffect`
5. **生效范围**：普通容器只在 Navigation 标题栏 / `barPosition: End` 的底部 TabBar 生效；
   其余仅弹窗类 / Slider / Toggle / Select 全页面生效
6. `colorInvert` 只对 `THIN`/`ULTRA_THIN` 生效，且**只对资源色**（`$r(...)`）生效
7. **圆形按钮热区 ≥ 40×40vp**（官方必须级），推荐 48×48vp

详见 [references/immersive-material/](references/immersive-material/)。

## 命令速查

```bash
# ── 本技能包的脚本 ──
node scripts/search-docs.mjs "关键词"                 # 查 40,651 篇官方文档（0.4s）
node scripts/search-docs.mjs --catalogs               # 看有哪些板块
node scripts/search-docs.mjs --read <板块>/<objectId>  # 读某篇全文
node scripts/search-skills.mjs "关键词"               # 查 144 个官方 Skill
node scripts/search-skills.mjs --list                 # 列出全部 Skill
node scripts/search-skills.mjs --read <skill-name>     # 读某个 Skill 的 SKILL.md
node scripts/fetch-huawei-doc.mjs <id> --catalog <板块>  # 刷新某页的图片链接

# 更新知识库（原始文件是本地中间产物，不入库）
node scripts/sync-huawei-docs.mjs                     # 同步官方文档
node scripts/build-doc-index.mjs                      # 重建文档索引
node scripts/sync-huawei-skills.mjs --download --tag HMOS
node scripts/build-skill-index.mjs                    # 重建 Skill 索引

# ── 鸿蒙工程构建（需 DevEco Studio 环境）──
ohpm install
hvigorw assembleHap --mode module -p product=default     # debug HAP
hvigorw assembleHap --mode module -p product=release     # release HAP
hvigorw clean

# ── DevEco CLI（若已安装 devecocli）──
devecocli check arkts entry/src/main/ets/pages/Index.ets  # 一轮编辑后跑一次
devecocli build
devecocli run
devecocli docs search 沉浸光感                            # 官方文档检索
devecocli skills add --all --agent claude-code            # 安装官方 Skill
```

> `DEVECO_SDK_HOME` 环境变量必须指向 SDK。Hvigor **忽略** `local.properties` 里的
> `hwsdk.dir`。

## 知识库说明

| 文件 / 目录 | 内容 | 用法 |
|---|---|---|
| `references/huawei-docs.db` | 40,651 篇官方文档（172 MB，正文 gzip） | `search-docs.mjs` 检索；`--read` 读全文 |
| `references/huawei-skills.db` | 144 个官方 Skill / 7,538 个文件（32 MB） | `search-skills.mjs` 检索；`--read` 读内容 |
| `references/huawei-skills/` | Skill 原始目录（**本地中间产物，不入库**） | 需完整资源时由同步脚本重建 |
| `references/huawei-docs/` | 文档原始 Markdown（**本地中间产物，不入库**） | 同上 |
| `references/deveco-docs/` | DevEco 工具链文档（本地） | 按目录浏览 |

> **两个 `.db` 由 Git LFS 管理**。克隆后若拿到的是 133 字节的指针文件，
> 先 `git lfs install && git lfs pull`；或自行重建：`sync-*` → `build-*-index`。
> 详见本文开头的 [⚠️ 首先确认：Git LFS 与知识库](#%EF%B8%8F-首先确认git-lfs-与知识库)。

**图片处理**：官方 CDN 图片是**签名 URL，约 24 小时过期**。检索结果与归档 Markdown
中保留了原始链接（正文内）与「图片清单」段（文末）。需要看图时：

1. 用 `scripts/fetch-huawei-doc.mjs <objectId> --catalog <板块>` 重新拉取该页，
   获取**新鲜**的签名链接
2. 再下载图片

**不要把过期链接当作可用资源。**

## 诚实边界

- 报告进度时说清楚**验证到哪一步**：改了代码 / 静态检查通过 / 构建通过 / 设备验证通过
- **未验证的不要说成已验证**
- 官方文档中**未找到依据的数值要显式标注**「未证实」，不要包装成规范
  （见 [references/design-specs.md](references/design-specs.md) 第 11 节）
- 构建失败、测试失败要**原文贴出错误**，不要只说「有问题」
