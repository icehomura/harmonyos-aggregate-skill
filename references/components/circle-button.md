# 圆形按钮与「更多」菜单

> **用途**：标题栏返回/操作项、悬浮控件、视图切换、收藏、「更多」入口。
> 本文给出官方热区硬约束与圆形按钮规范，以及项目里**圆形按钮的 5 件套写法**、
> **实测尺寸普查**、材质选型、`hitTestBehavior` 用法、`bindMenu`「更多」菜单，
> 和**手写顶部栏**的避让公式。

---

## 目录

- [1. 结论速查](#1-结论速查)
- [2. 官方规范](#2-官方规范)
  - [2.1 热区硬约束（UX 2.1.3.3）](#21-热区硬约束ux-2133)
  - [2.2 按钮类型与圆形按钮](#22-按钮类型与圆形按钮)
  - [2.3 菜单（bindMenu）](#23-菜单bindmenu)
  - [2.4 沉浸光感](#24-沉浸光感)
- [3. 项目实践](#3-项目实践)
  - [3.1 圆形按钮 5 件套标准写法](#31-圆形按钮-5-件套标准写法)
  - [3.2 三种写法变体](#32-三种写法变体)
  - [3.3 实测尺寸普查](#33-实测尺寸普查)
  - [3.4 材质选型：InteractiveClean vs FloatingControl](#34-材质选型interactiveclean-vs-floatingcontrol)
  - [3.5 hitTestBehavior：Block 防冒泡 / None 不吃事件](#35-hittestbehaviorblock-防冒泡--none-不吃事件)
  - [3.6 「更多」菜单：bindMenu + MenuItem + list_bullet](#36-更多菜单bindmenu--menuitem--list_bullet)
  - [3.7 手写顶部栏的避让公式](#37-手写顶部栏的避让公式)
  - [3.8 热区不足时的补救](#38-热区不足时的补救)
- [4. 未证实清单](#4-未证实清单)
- [5. 相关分技能](#5-相关分技能)

---

## 1. 结论速查

| 结论 | 类型 | 出处 |
|---|---|---|
| 点击热区**不得小于 40×40vp**（必须），推荐 **48×48vp** | 官方规范 | UX 标准 2.1.3.3，`ux-guidelines-general-0000001760708152.md:106-115` |
| 项目圆形按钮实测尺寸：**44 / 42 / 40 / 36 / 34vp** 五档；**40 与 44 是主流** | 项目实践 | 见 §3.3 普查表 |
| 实测图标字号区间 **16–24fp**（40vp 按钮配 18–22fp） | 项目实践 | 同上 |
| 标准写法 = `Stack({alignContent:Center})` + `SymbolGlyph` + `borderRadius(AppRadius.Pill)` + `backgroundColor(Color.Transparent)` + `attributeModifier(AppMaterial.modifier(AppMaterial.InteractiveClean))` + `clickEffect(LIGHT, 0.94)` | 项目实践 | `pages/SearchPage.ets:915-925` |
| 深色场景换 `AppMaterial.FloatingControl` | 项目实践 | `pages/PlayerPage.ets:976`、`pages/BookDetailPage.ets:944` |
| 全项目 **0 处 `more_vert` / 三点图标**；「更多」= `bindMenu` + `MenuItem` + `sys.symbol.list_bullet` | 项目实践 | `grep` 实测；`pages/RuleSourcePage.ets:1479-1485` |
| 手写顶部栏避让：`padding.top = WindowUtils.getStatusBarHeightVp() + AppSpace.Sm`（12vp），返回图标 `chevron_left` 24fp | 项目实践 | `pages/AboutPage.ets:108-122`、`pages/GuidePage.ets:144-158` |
| 全项目 **0 处 `hoverEffect`** | 项目实践 | `grep` 实测 |
| API 26 起 `Button` 等控件的**默认最小触摸热区高度 28vp → 32vp**（不影响显示高度） | 官方规范 | `ts-universal-attributes-touch-target.md:42` |
| ⚠️ 「官方图标集里没有 `more_vert`」 | **未证实** | 本地文档库无 Symbol 名称全表（见 §4-1） |

---

## 2. 官方规范

### 2.1 热区硬约束（UX 2.1.3.3）

【官方规范】出处：`references/huawei-docs/design-guides/ux-guidelines-general-0000001760708152.md:106-115`
（章节标题在 `:106`，标准描述在 `:110`，判定标准在 `:112`）

> **2.1.3.3 点击热区**
> 标准描述：手机/平板/折叠屏设备点击热区需满足最小尺寸要求：
> 主要交互元素或控件的可点击热区**至少为 48vp×48vp（推荐），不得小于 40vp×40vp（必须）**。
> 判定标准：触屏可点击热区尺寸需**大于或等于 40 vp × 40 vp**。
> 标准等级：**必须**

| 设备 | 推荐 | **必须（下限）** | 其他 |
|---|---|---|---|
| 手机 / 平板 / 折叠屏 | 48 × 48vp | **40 × 40vp** | — |
| 智能穿戴 | 46 × 46vp | **40 × 40vp** | — |
| 电脑 | — | — | 键鼠 ≥ 5mm；触屏 ≥ 7mm |
| 智慧屏（遥控器指向） | ≥ 4cm | ≥ 2.5cm | — |

同一约束在元服务标准中也是「必须」级：
`design-guides/ux-standard-overview-0000002019655177.md:48`
（`2.1.3.3 | 点击热区 | 点击热区不得小于 40vp×40vp | 必须`）。

跨设备开发规范同样表述（`harmonyos-guides/ide_touch-target-size.md:31`）：

> 主要交互元素或控件的可点击热区至少为 **48vp×48vp（推荐）**，
> **不得小于 40vp×40vp**。

> **这是官方对"按钮尺寸"唯一明确的硬性下限。** 圆形按钮的"标准直径"官方**未给出**
> （见 §4-2）；推论：**圆形按钮直径 ≥ 40vp 是安全区，40vp 以下必须补热区**。

### 2.2 按钮类型与圆形按钮

【官方规范】出处：`references/huawei-docs/design-guides/button-0000001929683228.md`

**类型**：强调按钮 / 普通按钮 / 文字按钮 / **圆形按钮** / 图标按钮（带容器 / 普通）。
**重要程度**：强调按钮 > 填充按钮 > 文字按钮。
**尺寸**：两档 `NORMAL` / `SMALL`，通过 `controlSize` 接口
（`ButtonStyleMode` / `ButtonRole` 提供风格子样式）。

原文相关段落：

> **在显示区域受到限制时，使用图标按钮可以节省空间**，让用户对当前界面内容执行
> 快速操作。**在以下场景较为常见：标题栏/工具栏、控制中心、悬浮显示在内容上**
> —— 分「带容器的图标按钮」与「普通图标按钮」两种。

> ⚠️ 同文档 **未给出圆形按钮的具体直径与图标尺寸**——只有「默认样式 / 多态」配图。
> 官方能提供的硬约束只有 §2.1 的 40×40vp 热区。
> 出处：`design-specs.md` §8 与 §11-1 已同步标注「未证实」。

电脑设备差异（同文档）：**使用更小的按钮圆角体现设备风格**，
且标题栏**去掉了圆形底板**——反证手机端标题栏按钮**带圆形底板**。

### 2.3 菜单（bindMenu）

【官方规范】出处：`references/huawei-docs/design-guides/menu-0000001957001877.md`

| 项 | 值 |
|---|---|
| **泛手机菜单宽度** | **固定 224vp** |
| 电脑菜单宽度 | 内容自适应，默认最小 224vp，**可配置但不得低于 64vp** |
| 菜单顺序 | **最常用菜单项放在菜单顶部**依次排列 |
| 基础构成 | `MenuItemOptions`（`ts-basic-components-menuitem.md`） |
| 多级菜单 | `subMenuExpandingMode`（原地展开 / 层叠） |
| 长按悬浮菜单 | `bindContextMenu` |
| 沉浸光感 | 「**组件已提供沉浸光感样式**，建议使用菜单组件时采用」 |

> 「**菜单项中不显示与当前内容无关的项。**」

**官方标题栏规范的配套约束**（`design-guides/titlebar-0000001929628982.md`，转引自 `design-specs.md` §5）：

> 操作项过多时**用「更多」图标收进菜单**，不要全部展示。

工具栏规范（`design-guides/toolbar-0000001929683232.md`）：

> 最多展示 **4 个操作 + 1 个更多**；
> **不允许工具栏只有「更多」**；**不允许仅显示一个操作**；
> **底部页签和工具栏不能同时使用**。

### 2.4 沉浸光感

【官方规范】`design-guides/button-0000001929683228.md`「### 沉浸光感」：

> **当按钮组件需要悬浮在页面之上常驻时，建议适配沉浸光感**提高按钮的精致度和
> 空间感，为界面带来更丰富的视觉体验。

> 如需要使用带有颜色的按钮样式时，推荐使用沉浸光感能力当中 **`materialColor`**
> 接口进行颜色适配，**避免直接使用 `backgroundColor` 直接传入颜色，
> 可能会导致沉浸光感效果被覆盖**。

**官方标题栏规范**（`design-guides/titlebar-0000001929628982.md`，转引自 `design-specs.md` §5）：

> **沉浸光感材质主要应用在可操作按钮**：左侧返回、右侧更多/搜索/文本按钮。

→ 这就是项目里"**只有圆形按钮挂材质**，纯文字标题不挂"的官方依据。

---

## 3. 项目实践

工程根：`C:\Users\icehomura\workspace\arkts\HarmonyOS-book`（下称 `<ROOT>`）。

### 3.1 圆形按钮 5 件套标准写法

【项目实践】最完整的样板：`pages/SearchPage.ets:913-926`

```ts
@Builder
buildSearchTitleBar() {
  Row({ space: AppSpace.Xs }) {                       // 8
    Stack({ alignContent: Alignment.Center }) {       // ① 居中容器
      SymbolGlyph($r('sys.symbol.chevron_left'))      // ② 图标
        .fontSize(22)
        .fontColor([$r('sys.color.icon_primary')])
    }
    .width(SEARCH_TITLE_CONTROL_HEIGHT)               // ③ 正方形（44 = 常量）
    .height(SEARCH_TITLE_CONTROL_HEIGHT)
    .borderRadius(AppRadius.Pill)                     // ④ 全圆角（999）
    .backgroundColor(Color.Transparent)               // ⑤ 显式透明，去掉默认底
    .attributeModifier(AppMaterial.modifier(AppMaterial.InteractiveClean))  // ⑥ 材质
    .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.94 })            // ⑦ 点击反馈
    .onClick(() => this.navStack.pop())
    // ...
  }
  .width('100%')
  .height(SEARCH_HEADER_HEIGHT)   // 56
  .padding({ left: AppSpace.Xs, right: AppSpace.Md })
  .alignItems(VerticalAlign.Center)
  .backgroundColor(Color.Transparent)
  .translate({ y: -this.searchCollapseOffset })
  .opacity(Math.max(0, Math.min(1, (SEARCH_HEADER_HEIGHT - this.searchCollapseOffset) / 24)))
  .visibility(this.searchCollapseOffset >= SEARCH_HEADER_HEIGHT - 0.5
    ? Visibility.Hidden : Visibility.Visible)
}
```

**七个必备要素**（缺一个就会出问题）：

| # | 要素 | 缺了会怎样 |
|---|---|---|
| ① | `Stack({ alignContent: Alignment.Center })` | 图标不居中，靠 `padding` 手调会随字号漂移 |
| ② | `SymbolGlyph` + `sys.symbol.*` | 用 `Image` 拿不到系统符号的动效/字重 |
| ③ | `width` = `height` | 不是正圆 |
| ④ | `borderRadius(AppRadius.Pill)`（= 999） | 是圆角矩形 |
| ⑤ | `backgroundColor(Color.Transparent)` | 出现一层不透明的默认底，挡住材质 |
| ⑥ | `attributeModifier(AppMaterial.modifier(AppMaterial.InteractiveClean))` | 没有沉浸光感；API <26 时也没有磨砂兜底 |
| ⑦ | `clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.94 })` | 没有点击反馈（项目禁止用 `hoverEffect` 替代） |

`AppRadius.Pill = 999`（`theme/Theme.ets:250`）。

### 3.2 三种写法变体

【项目实践】按"要不要热区/无障碍文本"选：

**(a) `Stack` + `SymbolGlyph`（最轻，无子节点阻塞）**

```ts
// pages/SearchPage.ets:719-727 —— 视图切换按钮 40×40
Stack({ alignContent: Alignment.Center }) {
  SymbolGlyph(this.viewMode === 0
    ? $r('sys.symbol.list_bullet') : $r('sys.symbol.square_grid_2x2'))
    .fontSize(18)
    .fontColor([$r('sys.color.font_primary')])
}
.width(40).height(40)
.borderRadius(AppRadius.Pill)
.onClick(() => { /* 切换布局 */ })
```

⚠️ 注意这一处**没有** `backgroundColor(Color.Transparent)`、也**没有**材质——
它的材质挂在外层的 40 高胶囊容器上（`SearchPage.ets:743-747`），
因为它是"筛选 tab 组 + 视图切换"共用一个背板。

**(b) `Button({ type: ButtonType.Circle })`（需要 `accessibilityText` 时）**

```ts
// pages/PlayerPage.ets:1497-1506 —— 关闭按钮
Button({ type: ButtonType.Circle }) {
  SymbolGlyph($r('sys.symbol.xmark'))
    .fontSize(20)
    .fontColor([$r('sys.color.font_secondary')])
}
.width(40).height(40)
.backgroundColor(Color.Transparent)
.accessibilityText($r('app.string.player_sleep_close'))
.onClick(() => { this.showSleepSheet = false; })
```

```ts
// pages/HomePage.ets:1475-1488 —— 收藏按钮
Button({ type: ButtonType.Circle }) {
  SymbolGlyph(this.isFeaturedFavorite(r) ? $r('sys.symbol.heart_fill') : $r('sys.symbol.heart'))
    .fontSize(22)
    .fontColor([this.isFeaturedFavorite(r) ? AppColor.Brand : $r('sys.color.font_secondary')])
}
.width(40).height(40)
.backgroundColor(Color.Transparent)
.enabled(!this.savingFavorite)
.accessibilityText(this.isFeaturedFavorite(r)
  ? $r('app.string.home_favorite_remove') : $r('app.string.home_favorite_add'))
```

> `ButtonType.Circle` 自带 `borderRadius`，**不需要**再写 `borderRadius(AppRadius.Pill)`。

**(c) `Button()` + 自定义内容（"更多"菜单，需要容器材质时）**

```ts
// pages/RuleSourcePage.ets:1479-1485
Button() {
  SymbolGlyph($r('sys.symbol.list_bullet')).fontSize(22).fontColor([AppColor.Brand])
}
.width(40).height(40)
.padding(0)                                  // ← Button 默认有 padding，必须清掉
.backgroundColor(Color.Transparent)
.borderRadius(AppRadius.Pill)
.accessibilityText($r('app.string.source_manage_more'))
.enabled(!this.isBulkTesting && !this.isImporting && this.busySourceUrl.length === 0)
.bindMenu(this.buildToolsMenu())
```

### 3.3 实测尺寸普查

【项目实践】`grep -rn "ButtonType.Circle\|borderRadius(AppRadius.Pill)" entry/src/main/ets`

| 直径 | 图标字号 | 出现处 | 形态 |
|---|---|---|---|
| **44vp** | 22fp | `pages/SearchPage.ets:920-921`（`SEARCH_TITLE_CONTROL_HEIGHT = 44`，`SearchPage.ets:30`） | `Stack` |
| **44vp** | 24fp | `pages/RuleSourcePage.ets:1334-1336` | `Stack` |
| **44vp** | 24fp | `pages/RuleSourceDebugPage.ets:173-174`、`RuleSourceEditPage.ets:286-287`、`RuleSourcePanelPage.ets:149` | `ButtonType.Circle` |
| **42vp** | 21fp | `pages/HomePage.ets:1674-1675`（`COLLAPSED_SEARCH_SIZE = 42`，`HomePage.ets:94`） | `Stack` + 材质 |
| **40vp** | 22fp | `pages/HomePage.ets:1480-1481`（收藏） | `ButtonType.Circle` |
| **40vp** | 22fp | `pages/RuleSourcePage.ets:1482`（更多） | `Button` + `bindMenu` |
| **40vp** | 20fp | `pages/PlayerPage.ets:1502-1503`（关闭） | `ButtonType.Circle` |
| **40vp** | 18fp | `pages/SearchPage.ets:725-726`（视图切换） | `Stack` |
| **36vp** | 20vp | `pages/RuleSourcePage.ets:1363-1364`（一键测试） | `Button` |
| **36vp** | 18fp | `components/ReaderSettingsSheet.ets:554-555`（抽屉关闭） | `Stack` + `borderRadius(18)` |
| **34vp** | 16fp | `components/ReaderSettingsSheet.ets:284-286`（字号步进） | `Stack` + `borderRadius(17)` |
| 52 / 64vp | 22 / 28fp | `pages/FavoritePage.ets:1077-1079`（拖拽删除靶区） | `Column` + `borderRadius(26/32)` |

**口径校正**（重要）：

> 任务交接里写的"标准直径 **40vp**（次级 36/44），图标 **22–24fp**"**只对了一半**。
> 实测：**44vp 出现 5 次，40vp 出现 4 次，两者都是主流**；
> 36/34vp 只出现在**抽屉内部**（那里不需要独立的圆形按钮热区竞争）；
> 图标字号区间是 **16–24fp**，**40vp 按钮实际配 18–22fp**，不是 22–24fp。
> 若把"22–24fp"当规范，配 40vp 按钮会偏大。

**统一规则（从普查归纳，可作为新代码的自检表）**：

```
直径 ≥ 40vp   → 图标 = 直径 × 0.45 ~ 0.55   （44→22、42→21、40→20/22）
直径 < 40vp   → 只允许出现在抽屉/分组内部，且必须补热区到 40vp
```

### 3.4 材质选型：InteractiveClean vs FloatingControl

【项目实践】`theme/Theme.ets:93-108`：

```ts
static get InteractiveClean(): uiMaterial.Material | undefined {
  if (!PlatformCompat.immersiveMaterial) return undefined;
  return AppMaterial.material('interactiveClean', uiMaterial.ImmersiveStyle.THIN,
    /* shadow */ false, /* interactive */ true, /* invert */ true);
}
static get FloatingControl(): uiMaterial.Material | undefined {
  if (!PlatformCompat.immersiveMaterial) return undefined;
  return AppMaterial.material('floating', uiMaterial.ImmersiveStyle.ULTRA_THIN,
    /* shadow */ true, /* interactive */ true);
}
```

| | `InteractiveClean` | `FloatingControl` |
|---|---|---|
| 档位 | `THIN` | `ULTRA_THIN`（更薄） |
| 阴影 | 无 | **有** |
| `colorInvert` | ✓ **反色** | ✗ |
| 适用 | 浅色/暖色背景上的按钮、标签、搜索框 | **深色背景**上的悬浮控件 |
| 出现次数 | 8 处 | 5 处 |

**`InteractiveClean` 的实际调用点**（`grep` 实测）：

| 文件:行 | 用途 |
|---|---|
| `components/GlassSurface.ets:30` | `GlassControlSurface` 默认材质 |
| `components/ImmersiveTabComponent.ets:49` | 分段标签（材质挂在整个 34vp 高胶囊上，`onClick` 在最外层 `Column`，未设 `hitTestBehavior`） |
| `pages/SearchPage.ets:747` | 结果工具栏胶囊容器 |
| `pages/SearchPage.ets:924` | 标题栏返回按钮 |
| `pages/SearchPage.ets:938` | 搜索框 |
| `pages/HomePage.ets:961` | 首页搜索框 |
| `pages/HomePage.ets:1678` | 收起态的圆形搜索按钮 |

**`FloatingControl` 的实际调用点**：

| 文件:行 | 用途 | 备注 |
|---|---|---|
| `pages/PlayerPage.ets:976`、`992` | 播放页底部渐变背景上的控件 | 带 fallback `AppColor.GlassSheetFallback`（深色兜底） |
| `pages/BookDetailPage.ets:944` | 详情页头图上的悬浮控件 | — |
| `pages/FavoritePage.ets:1041` | `CapsuleSegmentButtonV2` 的 `backgroundSystemMaterial` | 书架分段筛选 |
| `pages/ReaderKitVerifyPage.ets:94` | 顶部工具栏 | — |

**判别规则**：

```
按钮下方是深色内容（封面图、播放页渐变、深色兜底层）？
├─ 是 → AppMaterial.FloatingControl（ULTRA_THIN + shadow）
└─ 否 → AppMaterial.InteractiveClean（THIN + colorInvert）
```

> ⚠️ `colorInvert` 只对 `THIN`/`ULTRA_THIN` 生效，且**只对资源接口设置的颜色生效**
> （硬编码 `Color.White` 不生效）——见 SKILL.md「强制规范」第 6 条。

### 3.5 hitTestBehavior：Block 防冒泡 / None 不吃事件

【官方规范】`references/huawei-docs/harmonyos-references/ts-appendix-enums.md`
（`### HitTestMode9+`）：

| 名称 | 值 | 说明 |
|---|---|---|
| `Default` | 0 | 自身及子节点响应，**阻塞兄弟节点**，不影响祖先节点 |
| `Block` | 1 | 自身响应，**阻塞子节点、兄弟节点和祖先节点** |
| `Transparent` | 2 | 自身和子节点响应，**不阻塞**兄弟/祖先节点 |
| `None` | 3 | **自身不响应**，不阻塞子节点/兄弟/祖先节点 |
| `BLOCK_HIERARCHY` 20+ | 4 | 自身和子节点响应，阻止所有优先级较低的兄弟节点和父节点 |
| `BLOCK_DESCENDANTS` 20+ | 5 | 自身和所有后代都不响应，不影响祖先 |

**项目实测用法分布**（`grep -rhno "HitTestMode\.[A-Za-z]*"`）：
`None` ×13、`Transparent` ×7、`Block` ×2、`Default` ×1。

**(a) `HitTestMode.Block` —— 防点击冒泡到父级**（唯一 2 处，都在 `MiniPlayer`）

```ts
// components/MiniPlayer.ets:117-123
SymbolGlyph(this.playerState.isPlaying
  ? $r('sys.symbol.pause_fill') : $r('sys.symbol.play_fill'))
  .fontSize(24)
  .fontColor([$r('sys.color.font_primary')])
  .hitTestBehavior(HitTestMode.Block)          // ← 播放键不吃父级的"进入播放页"
  .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.9 })
  .onClick(() => this.onToggle())

// components/MiniPlayer.ets:125-130
SymbolGlyph($r('sys.symbol.forward_end_fill'))
  .fontSize(22)
  .fontColor([$r('sys.color.font_primary')])
  .hitTestBehavior(HitTestMode.Block)          // ← 下一集同理
  .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.9 })
  .onClick(() => this.onNext())
```

**为什么必须写**：迷你栏整体可点（`onTapBody` 进播放器），
播放键/下一集是**嵌入式子按钮**。不设 `Block` 时，点播放键会**同时**触发
父级的 `onClick`，导致"切歌同时跳页"。

**(b) `HitTestMode.None` —— 装饰层/材质层不吃事件**

```ts
// components/GlassSurface.ets:17-38 —— 三个图层全部不吃事件
Stack({ alignContent: Alignment.Center }) {
  Column()                                            // tint 层
    .width(LayoutPolicy.matchParent).height(LayoutPolicy.matchParent)
    .backgroundColor(this.tintColor)
    .hitTestBehavior(HitTestMode.None)                // ←
  Stack({ alignContent: Alignment.Center }) {         // 材质层（可点）
    this.content()
  }
  .borderRadius(this.cornerRadius)
  .attributeModifier(AppMaterial.modifier(AppMaterial.InteractiveClean))
  Column()                                            // 描边层
    .borderRadius(this.cornerRadius)
    .border({ width: 0.5, color: this.strokeColor })
    .hitTestBehavior(HitTestMode.None)                // ←
}
```

```ts
// pages/FavoritePage.ets:1045-1060 —— 手绘下划线指示器不吃事件
Row() {
  ForEach([0, 1, 2], (index: number) => {
    Column() {
      Row()
        .width(18)          // ← 下划线 18×2
        .height(2)
        .borderRadius(1)
        .backgroundColor(HomeTheme.Accent)
        .opacity(this.shelfFilter === index ? 1 : 0)
    }
    .layoutWeight(1)
  }, (index: number) => index.toString())
}
.width('100%')
.padding({ left: 2, right: 2, bottom: 4 })
.hitTestBehavior(HitTestMode.None)      // ← 整条下划线叠在分段按钮上，必须不吃事件
```

**判别规则**：

```
这个节点是"装饰层 / 材质层 / 指示器"，且它下方还有要点的东西？
├─ 是 → HitTestMode.None
└─ 否 → 这个节点是"嵌在可点父节点里的子按钮"？
        ├─ 是 → HitTestMode.Block
        └─ 否 → 不写（Default）
```

**(c) 动态开关：可交互性随可见性联动**（`pages/ReaderPage.ets:1142`）：

```ts
.hitTestBehavior(this.readerBarVisible ? HitTestMode.Transparent : HitTestMode.None)
```

底栏隐藏（`opacity = 0`）时设 `None`，避免"看不见但仍能点到"的幽灵热区。

### 3.6 「更多」菜单：bindMenu + MenuItem + list_bullet

【项目实践】全项目 **0 处 `more_vert` / `moreVert`**（`grep` 实测），
「更多」一律是 `bindMenu` + `MenuItem` + `sys.symbol.list_bullet`。

**触发按钮**（`pages/RuleSourcePage.ets:1479-1485`）：

```ts
Button() {
  SymbolGlyph($r('sys.symbol.list_bullet')).fontSize(22).fontColor([AppColor.Brand])
}
.width(40).height(40)
.padding(0)
.backgroundColor(Color.Transparent)
.borderRadius(AppRadius.Pill)
.accessibilityText($r('app.string.source_manage_more'))
.bindMenu(this.buildToolsMenu())
```

**菜单内容**（`pages/RuleSourcePage.ets:1563-1590`，节选）：

```ts
@Builder
buildToolsMenu() {
  Menu() {
    MenuItem({ content: $r('app.string.source_manage_groups') })
      .onClick(() => this.openManagement('groups'))
    MenuItem({ content: $r('app.string.source_manage_order') })
      .onClick(() => this.openManagement('order'))
    MenuItem({ content: $r('app.string.source_manage_tls') })
      .onClick(() => this.openManagement('tls'))

    // 分组标题 + 单选组
    MenuItemGroup({ header: $r('app.string.source_manage_filters') }) {
      MenuItem({ content: $r('app.string.source_manage_order_custom') })
        .onClick(() => this.applySort('custom'))
      MenuItem({ content: $r('app.string.source_manage_order_name') })
        // ...
    }
  }
}
```

**批量操作菜单用 `MenuItem` + `.enabled(false)` 表禁用**（`RuleSourcePage.ets:1584-1610`）：

```ts
MenuItem({ content: $r('app.string.source_manage_export_selected') })
  .onClick(() => this.runSelectedAction('export'))
MenuItem({ content: source.isLocked
  ? $r('app.string.source_manage_unlock') : $r('app.string.source_manage_lock') })
MenuItem({ content: $r('app.string.source_manage_group_assign') })
  .enabled(!source.isLocked)                         // ← 锁定源不允许改组
```

**「更多」的另一种形态：`titleBar.content.menu`**（`pages/FavoritePage.ets:941-951`）
——当宿主已经是 `HdsNavigation` 时，直接交给系统标题栏，**不要手绘按钮**：

```ts
.titleBar({
  avoidLayoutSafeArea: true,
  content: {
    title: { mainTitle: '书架' },
    bottomBuilder: { builder: (): void => this.buildShelfFilter(), height: SHELF_FILTER_ROW_HEIGHT },
    menu: {
      value: [{
        content: {
          icon: this.viewMode === 0
            ? $r('sys.symbol.list_bullet') : $r('sys.symbol.square_grid_2x2'),
          label: this.viewMode === 0 ? '切换为列表' : '切换为网格',
          action: () => this.toggleViewMode()
        }
      }]
    }
  },
  // ...
})
```

> `menu.value` 的每项是 `{ content: { icon, label, action } }`；
> **`label` 会作为无障碍文本**，不要省略。

**`bindMenu` 出现位置汇总**（`grep` 实测，共 6 处，全部在 `RuleSourcePage.ets`）：

| 行 | 用途 |
|---|---|
| `1389` | 顶部「更多」（`accessibilityText` + `bindMenu`） |
| `1485` | 工具栏「更多」（同上，主入口） |
| `1550` | 批量操作菜单 `buildBatchMenu()` |
| `1785` | 失败源处理菜单 `buildFailureActions()` |
| `2166` | 单个源的长按/更多菜单 `buildSourceMenu(source)` |

### 3.7 手写顶部栏的避让公式

【项目实践】当页面**不是** `HdsNavigation` 宿主（普通 `NavDestination` 内容）时，
顶部栏需要**自由 `Row` 手写**——7 个页面都用同一套公式：

```ts
// pages/AboutPage.ets:105-122（GuidePage.ets:141-158 等完全同构）
build() {
  Column() {
    Row() {
      SymbolGlyph($r('sys.symbol.chevron_left'))
        .fontSize(24)
        .fontColor([$r('sys.color.font_primary')])
        .onClick(() => this.navStack.pop())
      Text('关于')
        .fontSize(AppFont.Title)            // 18
        .fontColor($r('sys.color.font_primary'))
        .fontWeight(FontWeight.Bold)
        .margin({ left: AppSpace.Sm })      // 8
    }
    .width('100%')
    .padding({
      top: WindowUtils.getStatusBarHeightVp() + AppSpace.Sm,   // 状态栏 + 12
      left: AppSpace.Md, right: AppSpace.Md, bottom: AppSpace.Md
    })
    // ...
  }
  .width('100%')
  .height('100%')
  .backgroundColor($r('sys.color.background_primary'))
  .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
}
```

**要点**：

| 项 | 值 | 说明 |
|---|---|---|
| 顶部内边距 | `getStatusBarHeightVp() + AppSpace.Sm`（**+12vp**） | 12 个页面（About/Guide/Compliance/OpenSource/Privacy/DownloadManager/Import/…）一致 |
| 返回图标 | `sys.symbol.chevron_left`，**24fp**，`sys.color.font_primary` | 裸图标，**无圆形底板** |
| 标题 | `AppFont.Title`（18），`Bold`，左边距 `AppSpace.Sm`（8） | — |
| 根节点 | `.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])` | 让内容铺到状态栏下方，再用 `padding.top` 让回来 |
| 左右内边距 | `AppSpace.Md`（16） | 与官方「泛手机左右 margin 16」一致 |

**对比：`HdsNavigation` 宿主的页面**（Home/Favorite/Profile/ReadingStats/BlockMore）
**不手写顶部栏**，而是走 `.titleBar({...})` + `.titleMode(HdsNavigationTitleMode.MINI)`
+ `.hideBackButton(true)`，标题避让由 `avoidLayoutSafeArea: true` 托管
（`pages/ProfilePage.ets:178-214`、`pages/FavoritePage.ets:931-988`）。

**内容区避让浮动底部栏**：所有滚动容器都要留出底部空间——
`WindowUtils.getFloatingTabBottomVp()`（`utils/WindowUtils.ets:204-210`）：

```ts
bottomSafe + FLOATING_BOTTOM(4) + FLOATING_TAB_HEIGHT(60) + FLOATING_GAP(12)
// 其中 FLOATING_TAB_HEIGHT = 60、FLOATING_GAP = 12、FLOATING_BOTTOM = 4
```

用法：`List/.contentEndOffset(WindowUtils.getFloatingTabBottomVp())`
（`pages/FavoritePage.ets:885`）或写一个撑高的尾部 `ListItem`
（`pages/HomePage.ets:1322-1324`）。

### 3.8 热区不足时的补救

【项目实践 + 官方规范】项目里有 3 处圆形控件**低于 40vp**
（`ReaderSettingsSheet.ets:554` 的 36vp、`:284` 的 34vp、
`RuleSourcePage.ets:1363` 的 36vp），**都不符合官方 UX 2.1.3.3 的必须级下限**。

**正确补救方式**（官方思路，项目尚未采用）：用 `responseRegion` 扩热区，
视觉尺寸不变、热区达标：

```ts
Stack({ alignContent: Alignment.Center }) {
  SymbolGlyph($r('sys.symbol.xmark')).fontSize(18)
}
.width(36).height(36)
.borderRadius(18)
// 官方 API：references/huawei-docs/harmonyos-references/ts-universal-attributes-touch-target.md
// responseRegion(value: Array<Rectangle> | Rectangle)
// 默认值 { x:0, y:0, width:'100%', height:'100%' }（= 整个组件）
// 目标 48×48（推荐）或至少 40×40（必须）
.responseRegion({
  x: -6, y: -6, width: 48, height: 48   // 视觉 36，热区 48
})
.onClick(() => this.onClose())
```

> ⚠️ 「扩热区不能侵占相邻元素的热区」——`responseRegion` 只改变本节点的
> 触摸测试区域，若相邻控件间距 < 6vp 会互相争抢。设计时请保证**相邻圆形按钮
> 中心距 ≥ 48vp**。

**官方 API 补充事实**（`ts-universal-attributes-touch-target.md:38-58`）：

- `responseRegion` **首批接口从 API 8 开始支持**；
  调用 `responseRegionList`（22+）后，`responseRegion` 与 `mouseResponseRegion` **不再生效**。
- 「设置触摸热区属性时，**手指需在热区内按下**，随后抬起时若满足事件响应条件，
  事件将被触发。」
- **从 API 26.0.0 开始**，未主动设置时 `Button`、`Button` 模式的 `Toggle`、
  `Select`、`Chip`、`ChipGroup` 组件的**触摸热区默认最小高度从 28vp 变更为 32vp**。
  「该变更仅影响触摸命中范围，**不影响组件实际显示高度**。」
  → 即：`ButtonType.Circle` 40×40 的按钮在 API 26 设备上热区已有 40vp（宽度）；
  若想稳过 48vp 推荐值，仍需显式 `responseRegion`。

---

## 4. 未证实清单

| # | 条目 | 状态 |
|---|---|---|
| 1 | **官方图标集里没有 `more_vert`** | ⚠️ **未证实**。本地官方文档库（40,651 篇）**不含 HarmonyOS Symbol 名称全表**——`search-docs.mjs "more_vert"` 与 `"list_bullet"` 均 0 命中。要在 <https://developer.huawei.com/consumer/cn/design/harmonyos-symbol/> 开源图标站逐个确认。可证实的是：**本项目 0 处使用 `more_vert`** |
| 2 | 圆形按钮的**标准直径**与**图标尺寸** | ⚠️ **未证实**（官方只有配图，无文本数值；`design-specs.md` §11-1 已列）。官方唯一硬约束是热区 ≥40vp 必须 / ≥48vp 推荐 |
| 3 | 任务交接中的「标准直径 40vp（次级 36/44），图标 22–24fp」 | ⚠️ **口径需校正**。实测 44vp（5 处）与 40vp（4 处）**并列主流**；36/34vp 只在抽屉内；图标区间 **16–24fp**，40vp 按钮实际配 **18–22fp** |
| 4 | 「相邻圆形按钮中心距 ≥ 48vp」 | ⚠️ **未证实**（由"热区不重叠"推出的工程约束，非官方文本） |
| 5 | 手写顶部栏 **+12vp** 具体余量 | ⚠️ **未证实**（官方标题栏规范只给"单行高度 56vp"，未给状态栏下的额外余量；12vp 是项目自定） |
| 6 | `menu.value[].label` 会作为无障碍文本 | ⚠️ **未证实**（项目按此假定填写；官方 `menu` 类型定义未在本库中找到对应描述） |

---

## 5. 相关分技能

- [组件参考总目录](README.md) —— 证据分级约定、材质选型速查、跨组件强制约定
- [半模态抽屉](sheet.md) —— 抽屉内的关闭按钮 / 圆形步进按钮 / 文字按钮去灰底
- [列表 / 网格 / 骨架屏 / 下拉刷新](lists.md) —— 列表项右侧的操作图标、分段筛选
- [沉浸光感材质](../immersive-material/README.md) —— `ImmersiveStyle` 档位、生效范围铁律、功耗约束
- [官方设计规范数值表](../design-specs.md) —— §5 标题栏与工具栏、§8 按钮与点击热区
- [安全区与刘海避让](../immersive-material/safe-area.md) —— `AvoidArea` API、`padding.top` 避让

**官方 API / 设计文档原文**：

- `references/huawei-docs/design-guides/button-0000001929683228.md`
- `references/huawei-docs/design-guides/menu-0000001957001877.md`
- `references/huawei-docs/design-guides/ux-guidelines-general-0000001760708152.md`（2.1.3.3）
- `references/huawei-docs/design-guides/titlebar-0000001929628982.md`
- `references/huawei-docs/design-guides/toolbar-0000001929683232.md`
- `references/huawei-docs/harmonyos-references/ts-appendix-enums.md`（`HitTestMode`）
- `references/huawei-docs/harmonyos-references/ts-universal-attributes-hit-test-behavior.md`
- `references/huawei-docs/harmonyos-references/ts-universal-attributes-touch-target.md`（`responseRegion` / `responseRegionList`）
- `references/huawei-docs/harmonyos-references/ts-basic-components-menuitem.md`
- `references/huawei-docs/harmonyos-references/ts-universal-attributes-menu.md`
- `references/huawei-docs/harmonyos-guides/ide_touch-target-size.md`
