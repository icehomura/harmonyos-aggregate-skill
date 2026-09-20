# 列表 / 网格 / 骨架屏 / 下拉刷新

> **用途**：首页书单（分区块）、书架三列网格、搜索结果列表/网格、章节目录长列表、
> 加载骨架屏、下拉刷新、空态/错误态。
> 本文给出官方 `List` / `Grid` 设计规范、项目的三种容器选型表、
> `LazyForEach` + 稳定 key 的硬要求、骨架屏与下拉刷新的完整实现骨架。

---

## 目录

- [1. 结论速查](#1-结论速查)
- [2. 官方规范](#2-官方规范)
  - [2.1 列表（List）](#21-列表list)
  - [2.2 网格（Grid）](#22-网格grid)
  - [2.3 下拉刷新（Refresh）](#23-下拉刷新refresh)
  - [2.4 骨架屏](#24-骨架屏)
- [3. 项目实践](#3-项目实践)
  - [3.1 三种容器选型表](#31-三种容器选型表)
  - [3.2 List + lanes(3)：书架三列](#32-list--lanes3书架三列)
  - [3.3 Grid + columnsTemplate：搜索结果网格](#33-grid--columnstemplate搜索结果网格)
  - [3.4 内容边界避让：contentStartOffset / contentEndOffset](#34-内容边界避让contentstartoffset--contentendoffset)
  - [3.5 LazyForEach + 稳定 key（硬要求）](#35-lazyforeach--稳定-key硬要求)
  - [3.6 下拉刷新](#36-下拉刷新)
  - [3.7 骨架屏](#37-骨架屏)
  - [3.8 空态 / 错误态 / 加载态](#38-空态--错误态--加载态)
  - [3.9 断点自适应（AdaptiveLayout）](#39-断点自适应adaptivelayout)
- [4. 未证实清单](#4-未证实清单)
- [5. 相关分技能](#5-相关分技能)

---

## 1. 结论速查

| 结论 | 类型 | 出处 |
|---|---|---|
| 效率型列表通用行高：**48 / 56 / 64 / 72 / 96vp**；内容型：**64 / 72 / 80 / 96 / 120vp** | 官方规范 | `design-guides/list-0000001929853910.md` |
| 右侧元素与中间内容保持 **12vp** 间隔 | 官方规范 | 同上 |
| 横滑操作项宽度 **≤ 列表宽度的一半**，最多 **3–4 个**；滑动阈值 = 操作区宽度的 **1/2** | 官方规范 | 同上 |
| 长列表必须 `LazyForEach` + 稳定业务 key（不得用 index） | 项目实践 + 官方 FAQ | `SKILL.md` 强制规范 9；`harmonyos-faqs/faqs-arkui-705.md` |
| 书架三列用 `List.lanes(3, 8)`，**不用 `Grid`** | 项目实践 | `pages/FavoritePage.ets:875` |
| 搜索结果网格用 `Grid` + `columnsTemplate('1fr 1fr 1fr')` | 项目实践 | `pages/SearchPage.ets:804` |
| 底部避让统一 `WindowUtils.getFloatingTabBottomVp()` | 项目实践 | `pages/FavoritePage.ets:885`、`pages/SearchPage.ets:904` |
| 骨架屏行高必须**与真实行高对齐**（项目 65vp） | 项目实践 | `components/ChapterLoadingSkeleton.ets:14` + `ChapterListItem.ets:97` |
| **全项目 0 处 `WaterFlow`** | 项目实践 | `grep` 实测 |
| ⚠️ 官方 **design-guides 板块无「下拉刷新」独立规范** | **未证实** | `search-docs.mjs "下拉刷新" --catalog design-guides` → 0 命中 |

---

## 2. 官方规范

### 2.1 列表（List）

【官方规范】出处：`references/huawei-docs/design-guides/list-0000001929853910.md`

**结构原则**（原文）：

> 当列表出现在同一界面或是同一分组时，请使用**一致的视觉样式**（间距、对齐方式）。
> 通过**文本大小、颜色对比**来区分不同层级的列表项……
> 当内容条目或种类过多时，适当使用**分组或分类**有助于用户快速定位内容，
> 可以使用[子标题](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ohos-arkui-advanced-subheader)展示分组标题。

**信息层次**：一级文本 / 二级文本 / 三级文本；次要信息用更小字号或灰色。

**行高标准**（官方原文数值）：

| 类型 | 呈现 | 通用高度 |
|---|---|---|
| **效率型列表** | 纯文本 / 纯文本 + 图标 | **48 / 56 / 64 / 72 / 96vp** |
| **内容型列表** | 图片 + 文本混排 | **64 / 72 / 80 / 96 / 120vp** |

- 右侧元素支持「功能图标 / 文本 / 图标+文本」，**与中间列表内容保持 12vp 间隔**
- 「内容密度越高、结构越复杂，列表之间所需要的间距就需要越大」
- **不要将不同结构和布局的列表强制放在同一个分组中**

**可横滑列表**（官方原文）：

> 一般情况滑动后出现的**操作数量宽度不大于列表宽度的一半**，最多不超过
> **三至四个选项**；滑动所需的距离阈值通常为**操作区宽度的二分之一**。
> 请选择核心且重要的列表行为作为操作项。

**交互状态**（官方原表，需全部定义）：**悬浮态 / 点击态 / 选中态 / 不可用态 / 获焦态**。

> ⚠️ 项目**没有使用** `ListItem.swipeAction`（`grep` 0 命中），
> 而是用 `onDragStart` + 删除靶区实现书架删除（`pages/FavoritePage.ets:1071-1115`）。
> 这是项目自选方案，**不是官方推荐做法**。

**开发文档**：`ts-container-list.md` / `ts-container-listitem.md` /
`ts-container-listitemgroup.md`（本地副本在 `harmonyos-references/`）。

### 2.2 网格（Grid）

【官方规范】本地 `design-guides/` 板块**没有独立的「网格」设计规范文档**
（`ls design-guides/ | grep -i grid` 无命中）。可用的官方依据来源：

| 来源 | 内容 |
|---|---|
| `design-guides/convenient-life-0000001957252465.md` | 「**折叠屏展开态上 3 列宫格布局最佳，平板横屏默认 5 列宫格布局最佳**」；「在宽屏上建议一排显示更多图标数量，但**折叠屏不超过一排 8 个，平板横屏不超过一排 12 个**」 |
| `design-guides/ux-guidelines-large-screen-0000001807707561.md` | 折叠屏标准 3.2.1.4「宫格图片信息量适中 | 宫格图片控件占比符合要求 **必须**」 |
| `harmonyos-references/ts-container-grid.md` / `ts-container-griditem.md` | `columnsTemplate` / `rowsGap` / `columnsGap` / `cachedCount` |

> ⚠️ 「宫格图片控件占比」的具体数值在官方配图中，**本库无文本数值**（见 §4）。

### 2.3 下拉刷新（Refresh）

【官方规范】本地 `design-guides/` 板块**无「下拉刷新」独立规范**
（`search-docs.mjs "下拉刷新" --catalog design-guides` → 0 命中）。
可用的官方依据是 API 文档：`references/huawei-docs/harmonyos-references/ts-container-refresh.md`

| API | 说明 |
|---|---|
| `Refresh({ refreshing: $$this.isRefreshing, builder: this.xxx() })` | `refreshing` 双向绑定；`builder` 自定义刷新区域 |
| `refreshOffset(value: number)` 12+ | 触发刷新的下拉偏移量（vp）。**`promptText` 有效时默认 96vp** |
| `pullToRefresh(value: boolean)` 12+ | 下拉距离超过 `refreshOffset` 时**是否能触发刷新**，默认 `true` |
| `pullDownRatio(value: number)` 12+ | 下拉摩擦系数（替代已废弃的 `friction`，`friction` 从 API 11 起废弃） |
| `onRefreshing(callback)` | 进入刷新状态时触发，等同于 `onStateChange` 中 state 为 `Refresh` |
| `onStateChange(callback)` | 跟踪全部状态：`Inactive` / `Drag` / `OverDrag` / `Refresh` / `Done` |
| `onOffsetChange` | 下拉偏移量变化（项目用它驱动自定义指示器） |

### 2.4 骨架屏

【官方规范】出处：

- `references/huawei-docs/architecture-guides/skeleton_screen-0000002294856764.md`
  ——「**骨架屏是一种在页面内容加载过程中显示占位符的视觉元素**，通常用于展示
  页面的大致布局和结构，直到该页面内容加载完成，可提升用户体验。」
  官方示例基于 `List` + `animateTo` + `linearGradient` 实现，
  「也可适用于**首页内容、消息列表**等页面数据加载场景」。
- `references/huawei-docs/harmonyos-faqs/faqs-arkui-705.md`
  ——「**LazyForEach 实现骨架屏预加载效果**」。

> ⚠️ 官方**未给出**骨架屏的具体行高、色值、呼吸动效时长。
> 项目用的是「**呼吸式明暗（opacity 0.42↔0.85，900ms，Alternate 无限循环）**」——
> 这是项目自选方案（见 §3.7），不是官方规范。

> ⚠️ 官方示例用 `linearGradient` + `animateTo` 做扫光；项目用**整体 opacity 呼吸**，
> 属于不同实现路径，效果都成立。

---

## 3. 项目实践

工程根：`C:\Users\icehomura\workspace\arkts\HarmonyOS-book`（下称 `<ROOT>`）。

### 3.1 三种容器选型表

【项目实践】`grep -rn "List(\|Grid(\|Swiper(\|WaterFlow(" entry/src/main/ets`

| 场景 | 容器 | 出处 | 为什么 |
|---|---|---|---|
| 首页分区块书单（标题 + 内容块混合、需要 `ListItemGroup` 分组与 `nestedScroll`） | `List` | `pages/HomePage.ets:1181` | 需要 `ListItemGroup` + `nestedScroll` 与轮播协作 |
| 书架三列书卡 | **`List` + `lanes(3)`** | `pages/FavoritePage.ets:862, 875` | **首尾边界与 `Refresh` 协作更稳**（见 §3.2） |
| 搜索结果（可切列表 / 网格） | `List`（列表）与 **`Grid`**（网格）**两个平级容器，靠 `viewMode` 切换** | `pages/SearchPage.ets:889`、`:792` | 列表项需要"封面 + 3 行文本"的横排布局，`Grid` 表达不了 |
| 章节长列表（抽屉内） | `List` + `LazyForEach` | `pages/PlayerPage.ets:1401` | 长列表 + `scrollBarWidth` 自定义 |
| 首页推荐轮播（分页） | `Swiper` | `pages/HomePage.ets:1411` | — |
| — | **`WaterFlow`** | **0 处** | 项目不用瀑布流 |

### 3.2 List + lanes(3)：书架三列

【项目实践】`pages/FavoritePage.ets:860-889`：

```ts
if (this.viewMode === 0) {
  // 三列书卡复用 List 的首尾边界，内容不足一屏时回弹后仍停留在安全起点。
  List({ scroller: this.listScroller, space: AppSpace.Md }) {   // 16
    LazyForEach(this.bookDataSource, (book: Book) => {
      ListItem() {
        this.buildBookTile(book)
      }
      // key 带上"总章数 + 当前章索引"：LazyForEach 对相同 key 的项会复用旧节点、
      // 不重跑 buildBookTile。刷新后章数 742→758 但 book.id 不变 → 贴片卡在旧值。
      // 把会变的展示量编进 key，值一变 key 变 → 强制重建贴片。
    }, (book: Book) => `${book.id}:${this.getChapterCount(book)}:${this.chapterIdxMap[book.id] ?? -1}`)

    ListItem() {
      this.buildAddTile()          // 末尾"+ 添加"格子
    }
  }
  .lanes(3, AppSpace.Sm)                                       // 3 列，列间距 8
  .cachedCount(6)
  .width('100%')
  .height('100%')
  .padding({ left: AppSpace.Md, right: AppSpace.Md })           // 左右 16
  .contentStartOffset(WindowUtils.getStatusBarHeightVp() + SHELF_FILTER_TOP_OFFSET +
    SHELF_FILTER_ROW_HEIGHT + SHELF_CONTENT_GAP)                // 见 §3.4
  .contentEndOffset(WindowUtils.getFloatingTabBottomVp())
  .scrollBar(BarState.Off)
  // 空书架只有添加入口，也需要在上下边界提供原生回弹。
  .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
  .backgroundColor(Color.Transparent)
}
```

**为什么用 `List.lanes` 而不是 `Grid`**（源码注释给出的理由，`FavoritePage.ets:861`）：

> 三列书卡复用 **List 的首尾边界**，内容不足一屏时回弹后仍停留在安全起点。

`List.lanes(3, gap)` 是官方 API：把列表项按指定列数排列，
**`ListItem` 逐个流动填充**（不用像 `Grid` 那样套 `GridItem`），
且继承 `List` 的 `contentStartOffset` / `contentEndOffset` / `onScrollIndex` 等能力。

相关常量（`pages/FavoritePage.ets:29-32`）：

```ts
const MINI_TITLE_BAR_HEIGHT: number = 56;
const SHELF_FILTER_TOP_OFFSET: number = MINI_TITLE_BAR_HEIGHT;  // 56
const SHELF_FILTER_ROW_HEIGHT: number = 40;
const SHELF_CONTENT_GAP: number = 18;
```

### 3.3 Grid + columnsTemplate：搜索结果网格

【项目实践】`pages/SearchPage.ets:790-819`：

```ts
@Builder
buildGridResults() {
  Grid(this.resultScroller) {
    LazyForEach(this.resultDataSource, (book: Book, index: number) => {
      GridItem() {
        BookCard({
          book: book,
          indexHint: index,
          coverAspectRatio: SEARCH_COVER_ASPECT_RATIO,   // 0.75（SearchPage.ets:28）
          onTap: () => this.openBook(book)
        })
      }
    }, (book: Book) => book.id)                          // 稳定 key = book.id
  }
  .columnsTemplate('1fr 1fr 1fr')                        // 三列等宽
  .onDidScroll(() => this.syncSearchCollapse())
  .columnsGap(AppSpace.Sm)                               // 8
  .rowsGap(AppSpace.Md)                                  // 16
  .cachedCount(6)
  .layoutWeight(1)
  .width('100%')
  .scrollBar(BarState.Off)
  .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
  .padding({ left: AppSpace.Md, right: AppSpace.Md })
  .attributeModifier(new CompatibleGridInsets(
    WindowUtils.getStatusBarHeightVp() + SEARCH_HEADER_HEIGHT + RESULT_TOOLBAR_HEIGHT + AppSpace.Sm,
    WindowUtils.getFloatingTabBottomVp() + AppSpace.Lg,
    AppSpace.Md))
}
```

**为什么 `Grid` 用 `CompatibleGridInsets` 而 `List` 直接用 `.contentStartOffset()`**：
`Grid` 的 `contentStartOffset` / `contentEndOffset` **从 API 22 才开始支持**
（`utils/PlatformCompat.ets:18` 注释），所以用 `AttributeModifier` 分流：

```ts
// utils/PlatformCompat.ets:19-38
export class CompatibleGridInsets implements AttributeModifier<GridAttribute> {
  applyNormalAttribute(instance: GridAttribute): void {
    if (PlatformCompat.supports(22)) {
      instance.padding({ left: this.horizontal, right: this.horizontal })
        .contentStartOffset(this.top).contentEndOffset(this.bottom);
    } else {
      // API 20 用内边距保护首尾内容
      instance.padding({ left: this.horizontal, right: this.horizontal,
        top: this.top, bottom: this.bottom });
    }
  }
}
```

> **这是"版本分流用设备能力判断"的活例**：`PlatformCompat.supports(n)` 读
> `deviceInfo.sdkApiVersion`（`utils/PlatformCompat.ets:4-7`），
> **不用编译版本**——因为工程 `targetSdkVersion` 会高于设备实际能力。

### 3.4 内容边界避让：contentStartOffset / contentEndOffset

【项目实践】所有贴在沉浸式容器里的滚动组件都要处理这两种避让：

| 方向 | 避让对象 | 公式 | 出处 |
|---|---|---|---|
| **顶部** | 状态栏 + 标题栏 + 工具栏 + 间距 | `WindowUtils.getStatusBarHeightVp() + 常量之和` | `SearchPage.ets:902-903`、`FavoritePage.ets:883-884` |
| **底部** | 浮动 Tab 栏 + MiniPlayer | `WindowUtils.getFloatingTabBottomVp()` | `SearchPage.ets:904`、`FavoritePage.ets:885` |

`getFloatingTabBottomVp()` 的定义（`utils/WindowUtils.ets:194-210`）：

```ts
private static readonly FLOATING_TAB_HEIGHT: number = 60;
private static readonly FLOATING_GAP: number = 12;
private static readonly FLOATING_BOTTOM: number = 4;

/**
 * TabContent 底部需要为浮动 Tab 栏让出的高度(vp)。
 * 计算公式: bottomSafe + FLOATING_BOTTOM + FLOATING_TAB_HEIGHT + FLOATING_GAP
 * 说明: FloatingTabBar 内部用 padding-bottom = bottomSafe 把自身抬到导航条之上,
 *       所以业务页留出的高度也要包含 bottomSafe,否则最后一行会被手势条遮住一截。
 */
static getFloatingTabBottomVp(bottomSafeVp?: number): number {
  const safeBottom = bottomSafeVp !== undefined ? bottomSafeVp : WindowUtils.getBottomSafeVp();
  return safeBottom + WindowUtils.FLOATING_BOTTOM
       + WindowUtils.FLOATING_TAB_HEIGHT + WindowUtils.FLOATING_GAP;
}
```

**两种用法**（按容器能力选）：

```ts
// (a) 有 contentEndOffset 的容器（List / Grid API 22+ / Scroll）
.contentEndOffset(WindowUtils.getFloatingTabBottomVp() + AppSpace.Lg)

// (b) 没有 contentEndOffset 时，手动补一个撑高的尾部 ListItem
//     pages/HomePage.ets:1321-1324
ListItem() {
  Column().height(WindowUtils.getFloatingTabBottomVp() + AppSpace.Lg)
}
```

### 3.5 LazyForEach + 稳定 key（硬要求）

【项目实践 + 官方 FAQ】

**硬要求**（`SKILL.md` 强制规范 9）：

> **长列表必须 `LazyForEach` + 稳定 key，不得用 index 作 key。**

**key 必须是"会变的展示量也编进去"**——这是最容易踩的坑。项目里最完整的教训在
`pages/FavoritePage.ets:866-870`：

```ts
// key 带上"总章数 + 当前章索引"：LazyForEach 对相同 key 的项会复用旧节点、
// 不重跑 buildBookTile。刷新后章数 742→758 但 book.id 不变 → 贴片卡在旧值。
// 把会变的展示量编进 key，值一变 key 变 → 强制重建贴片。
}, (book: Book) => `${book.id}:${this.getChapterCount(book)}:${this.chapterIdxMap[book.id] ?? -1}`)
```

**项目中的 key 写法汇总**：

| 文件:行 | key | 说明 |
|---|---|---|
| `FavoritePage.ets:870` | `` `${book.id}:${章数}:${当前章索引}` `` | 含展示量，防复用旧值 |
| `SearchPage.ets:802` | `book.id` | 纯 id 足够（无会变的展示量） |
| `HomePage.ets:1195` | `` `${block.sourceUrl}#${block.moreUrl}#${block.title}` `` | 复合键 |
| `HomePage.ets:1260` | `` `${this.currentSource?.bookSourceUrl}#${row.key}` `` | 复合键 |
| `HomePage.ets:1416` | `` `${block.sourceUrl}#featured#${rowBook.bookUrl}` `` | 复合键 |
| `PlayerPage.ets:1440` | `DownloadPolicy.stablePageUrl(ch) \|\| ch.id` | 带兜底 |
| `ReaderPage.ets:1477` | `` `${this.bookId}:${chapter.id ?? index}` `` | 带兜底 |

**其他配套属性**：

| 属性 | 项目取值 | 说明 |
|---|---|---|
| `.cachedCount(n)` | `1` / `5` / `6` | 首页推荐区 `1`、分类书单 `5`、书架与搜索 `6` |
| `.scrollBar(BarState.Off)` | 全部 | 沉浸式页面不显示滚动条（**唯一例外**：章节列表 `BarState.On` + `scrollBarWidth(8)`，`PlayerPage.ets:1444-1446`） |
| `.edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })` | 全部 | 内容不足一屏也要能回弹 |

### 3.6 下拉刷新

【项目实践】两种写法，**不要混用**：

**(a) `Refresh` + 自定义指示器（首页，`pages/HomePage.ets:1042-1064`）**

```ts
Refresh({ refreshing: $$this.isRefreshing, builder: this.emptyRefreshIndicator() }) {
  Scroll(this.headerScroller) {
    Column() {
      this.buildHomeNavigation()
    }
    .width('100%')
    .height(this.contentHeight + this.headerScrollRange)
    .clip(false)
    // 刷新位移独立于展开动画，避免覆盖原生弹簧的 translate。
    .translate({ y: -this.refreshPullOffset })
  }
  .width('100%').height('100%')
  .scrollBar(BarState.Off)
  .enableScrollInteraction(!this.carouselTransitioning)
  .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
  .clip(false)
  .onDidScroll(() => this.syncHeaderScrollState())
}
.onRefreshing(() => this.handleHomeRefresh())
.onOffsetChange((offset: number) => { this.refreshPullOffset = Math.max(0, offset); })
.refreshOffset(HOME_REFRESH_TRIGGER_DISTANCE)     // 96
.pullDownRatio(HOME_REFRESH_PULL_DOWN_RATIO)      // 0.5
```

配套常量（`pages/HomePage.ets:87-89`）：

```ts
const HOME_REFRESH_TRIGGER_DISTANCE: number = 96;
const HOME_REFRESH_PULL_DOWN_RATIO: number = 0.5;
```

**自定义指示器的关键点**：把 `Refresh` 的 `builder` 传成**零尺寸占位**
（`emptyRefreshIndicator` = `Column().width(0).height(0)`，`HomePage.ets:1027-1030`），
**原生指示器不显示**；再用 `onOffsetChange` 把偏移量存进 `refreshPullOffset`，
驱动自己画的指示器（`pullRefreshIndicator`，`HomePage.ets:999-1025`）：

```ts
@Builder
pullRefreshIndicator() {
  Row() {
    if (this.isRefreshing) {
      LoadingProgress().width(24).height(24).color(AppColor.Brand)   // ← 品牌色
    } else {
      Progress({ value: Math.min(100, this.refreshPullOffset / HOME_REFRESH_TRIGGER_DISTANCE * 100),
                 total: 100, type: ProgressType.Ring })
        .width(24).height(24)
        .color(AppColor.Brand)
        .backgroundColor(Color.Transparent)
        .style({ strokeWidth: 2, enableSmoothEffect: false })
    }
  }
  .width('100%')
  .height(this.refreshPullOffset)          // ← 高度跟着下拉位移长出来
  .justifyContent(FlexAlign.Center)
  .opacity(Math.min(1, this.refreshPullOffset / 24))
  .clip(true)
}
```

> 这是"**用原生手势 + 自绘视觉**"的模式：`Refresh` 只负责手势与状态机，
> 视觉完全自控，才能把指示器放在分类 Tab 下方而不是顶部。

**(b) 原生指示器（书架，最简写法，`pages/FavoritePage.ets:919-925`）**

```ts
.onRefreshing(() => {
  this.refreshOnlineBooks().finally(() => { this.isRefreshing = false; });
})
.refreshOffset(64)
.pullToRefresh(true)
```

`Refresh({ refreshing: $$this.isRefreshing, builder: this.refreshIndicator() })`
（`FavoritePage.ets:859`），指示器是一个 56 高的 `Row` + `LoadingProgress`
（`FavoritePage.ets:1008-1023`），并用 `translate` 把它压到筛选栏下方。

### 3.7 骨架屏

【项目实践】两个骨架屏组件，**共用同一套动效公式**。

**(a) `components/ChapterLoadingSkeleton.ets`（章节目录，最规范的一份）**

```ts
/** 与 ChapterListItem 单行实际高度对齐 */
const SKELETON_ROW_HEIGHT: number = 65;
/** 骨架行标题宽度序列，制造长短参差的真实感 */
const TITLE_WIDTHS: string[] = ['68%', '54%', '76%', '46%', '62%', '72%', '50%', '66%'];

@ComponentV2
export struct ChapterLoadingSkeleton {
  @Param horizontalInset: number = AppSpace.Lg;   // 24
  @Param isTextBook: boolean = false;
  @Param rowCount: number = 8;
  @Local pulsing: boolean = false;
  // ...
}
```

**四个关键设计点**：

| 点 | 做法 | 原因 |
|---|---|---|
| **行高对齐** | `SKELETON_ROW_HEIGHT = 65`，与 `ChapterListItem` 的 `padding(14+14) + BodyL(16) + Caption(12) ≈ 65` 对齐（`components/ChapterListItem.ets:97`） | 真实列表替换骨架时**不产生跳动**（源码注释原文） |
| **宽度参差** | 8 个 `TITLE_WIDTHS` 百分比轮转（`68% / 54% / 76% / …`） | 制造长短参差的真实感 |
| **色值** | `AppColor.Divider`（主）+ `HomeTheme.ProgressTrack` 或 `.opacity(0.6)`（次） | 复用现有令牌，深浅色自动适配 |
| **动效** | 整体 opacity `0.42 ↔ 0.85`，`900ms`，`EaseInOut`，`iterations: -1`，`Alternate` | "呼吸式明暗"，等待期间保持"活着"的感觉 |

```ts
Column() {
  ForEach(this.rowIndices(), (index: number) => { this.skeletonRow(index) },
    (index: number) => `chapter-skeleton-${index}`)
}
.width('100%')
// 呼吸式明暗：无限交替，等待期间保持"活着"的感觉
.opacity(this.pulsing ? 0.42 : 0.85)
.animation({ duration: 900, curve: Curve.EaseInOut, iterations: -1, playMode: PlayMode.Alternate })
```

**顶部提示行**（`ChapterLoadingSkeleton.ets:79-91`）——明确告知用户正在做什么：

```ts
Row({ space: AppSpace.Xs }) {
  LoadingProgress().width(16).height(16).color(AppColor.Brand)   // ← 品牌色
  Text(this.isTextBook ? '正在加载章节目录…' : '正在加载节目列表…')
    .fontSize(AppFont.Caption)
    .fontColor($r('sys.color.font_secondary'))
}
```

**入场淡入**（防止骨架屏自己也"闪"一下，`ChapterLoadingSkeleton.ets:116`）：

```ts
.transition(TransitionEffect.opacity(0).animation({ duration: AppMotion.Fast }))  // 150ms
```

**(b) `HomeLoadingSkeleton`（首页，`pages/HomePage.ets:106-…`）**

同一套 `pulsing` + `onDidBuild()` 公式，但骨架形状按首页结构定制：
`skeletonCover`（封面卡 `aspectRatio(0.75)`）、`skeletonFeaturedRow`、
`skeletonFeaturedSection` 等。**通过 `@Param` 按需裁剪**：

```ts
// pages/HomePage.ets:1185-1188（只有推荐区在加载时）
HomeLoadingSkeleton({ showCarousel: false, contentWidth: this.contentWidth })
// pages/HomePage.ets:1604
HomeLoadingSkeleton({ showRecommendations: false, contentWidth: this.contentWidth })
```

**(c) 共用的动效启动方式**（两个组件都一样）：

```ts
onDidBuild(): void {
  if (!this.pulsing) this.pulsing = true;
}
```

在 `onDidBuild` 里把 `pulsing` 从 `false` 置 `true`，触发 `.animation()`
产生一次"从 0.85 到 0.42 再无限交替"的动画。

**组件级注意事项**：

- **`rowIndices()` 不用 `Array.from({length})`**——ArkTS 下 ArrayLike 类型推断会报错，
  必须显式 for 循环 push（`ChapterLoadingSkeleton.ets:32-40` 注释）。
- **骨架屏本身也要占满空间**：用 `.layoutWeight(1)`，避免父容器塌缩。

### 3.8 空态 / 错误态 / 加载态

【项目实践】三种非正常态的**统一公式**（首页、搜索页、记录页都同构）：

```ts
// 加载态（pages/HomePage.ets:1262-1274）
ListItem() {
  Column() {
    LoadingProgress().width(40).height(40).color(AppColor.Brand)   // ← 必须品牌色
    Text('加载中...')
      .fontSize(AppFont.Body)
      .fontColor($r('sys.color.font_tertiary'))
      .margin({ top: AppSpace.Sm })
  }
  .width('100%').height(300).justifyContent(FlexAlign.Center)
}

// 空态 / 错误态（pages/HomePage.ets:1197-1215）
ListItem() {
  Column() {
    SymbolGlyph($r('sys.symbol.magnifyingglass'))     // 错误态换成 exclamationmark_circle
      .fontSize(48)
      .fontColor([$r('sys.color.font_tertiary')])
    Text($r('app.string.search_placeholder'))
      .fontSize(AppFont.Body).fontColor($r('sys.color.font_tertiary'))
      .margin({ top: AppSpace.Md })
    Text(this.homeError || $r('app.string.home_source_empty'))
      .fontSize(AppFont.Caption).fontColor($r('sys.color.font_tertiary'))
      .margin({ top: AppSpace.Xs })
  }
  .width('100%').height(300).justifyContent(FlexAlign.Center)
  .onClick(() => this.onSearchTap())                  // ← 空态可点，引导用户去搜索
}
```

**统一约定**：

| 项 | 值 |
|---|---|
| 图标 | `sys.symbol.magnifyingglass`（空态）/ `sys.symbol.exclamationmark_circle`（错误态） |
| 图标字号 | **48fp** |
| 图标色 | `$r('sys.color.font_tertiary')` |
| 主文案 | `AppFont.Body`（14），`font_tertiary` |
| 副文案 | `AppFont.Caption`（12），`font_tertiary`，`margin.top = AppSpace.Xs`（8） |
| 占位高度 | **300vp**（首页/搜索）/ **220vp**（分类总览）/ **56–72vp**（区内联空态） |
| 加载圈 | `LoadingProgress` + `.color(AppColor.Brand)`（**品牌色，不得用系统默认蓝**） |

### 3.9 断点自适应（AdaptiveLayout）

【项目实践】`utils/AdaptiveLayout.ets:4-8`——**手机窗口统一断点**：

```ts
private static readonly COMPACT_WIDTH: number = 360;
private static readonly COMPACT_HEIGHT: number = 760;
private static readonly PLAYER_FIXED_HEIGHT: number = 438;
private static readonly PLAYER_MIN_COVER: number = 136;

static isCompact(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return width < AdaptiveLayout.COMPACT_WIDTH || height < AdaptiveLayout.COMPACT_HEIGHT;
}
```

> 源码注释：「手机窗口统一断点。**自由多窗只改变窗口尺寸，页面无需感知具体窗口模式。**」
> —— 这是把"窗口形态"降维成"宽高数值"的做法，避免 `if (isFoldable)` 之类的分支。

| 方法 | 紧凑 | 常规 | 说明 |
|---|---|---|---|
| `horizontalPadding` | 16 | 24 | 页面左右内边距 |
| `sectionSpacing` | 16 | 24 | 区块间距 |
| `playerTopSpacing` | 8 | 12 | 播放页顶部间距（再叠加状态栏高度） |
| `playerBottomSpacing` | 0 | 24 | 紧凑时直接贴安全区 |
| `playerCoverSize` | — | — | `min(可用宽, clamp(136, 高-438, 260))`，**优先按高度收缩** |
| `playerNeedsScroll` | — | — | `高 < 438 + 136` 时需要滚动 |
| `detailHeroHeight` | 216 | 230 | 详情页头图 |
| `detailCoverWidth/Height` | 84 / 109 | 100 / 130 | 详情页封面 |

**用法**：页面用 `onSizeChange` 记录 `viewportWidth` / `viewportHeight`，
再在 `@Builder` 里调对应方法（`pages/PlayerPage.ets:259-280`）。

> 项目**没有**用官方的 `GridRow` / `GridCol` 栅格，而是这套手写断点。
> 官方栅格档位（<600 / 600–840 / ≥840）见 `design-specs.md` §2。

---

## 4. 未证实清单

| # | 条目 | 状态 |
|---|---|---|
| 1 | 官方 **design-guides 板块无「下拉刷新」独立规范** | ⚠️ **未证实（无规范）**。`search-docs.mjs "下拉刷新" --catalog design-guides` → 0 命中。只能引 API 文档，**不要编造"官方推荐刷新距离"** |
| 2 | 官方 **design-guides 板块无「网格 / 宫格」独立规范** | ⚠️ **未证实（无规范）**。仅有折叠屏「3 列最佳」「一排不超过 8 个」等散落表述 |
| 3 | 「宫格图片控件占比」具体数值 | ⚠️ **未证实**（官方标准 3.2.1.4 只说"符合要求"，数值在配图中） |
| 4 | 骨架屏的**行高 / 色值 / 呼吸动效时长**（0.42↔0.85、900ms） | ⚠️ **未证实**（项目自选方案；官方示例用 `linearGradient` + `animateTo` 扫光，未给数值） |
| 5 | 骨架屏 `SKELETON_ROW_HEIGHT = 65` 与真实行高"对齐" | ⚠️ **部分未证实**。`ChapterListItem` 无显式 `height`，65 是"`padding 14+14` + `BodyL 16` + `Caption 12`"的推算值（`ChapterListItem.ets:40,49,97`），非官方数值 |
| 6 | 下拉刷新触发距离 **96vp** 与比率 **0.5**（首页） | ⚠️ **未证实**（项目自定。官方只说 `promptText` 有效时 `refreshOffset` 默认 **96vp**，纯属巧合） |
| 7 | 空态/错误态占位高度 **300vp**、图标 **48fp** | ⚠️ **未证实**（项目自定，非官方数值） |
| 8 | 书架用 `ListItem.swipeAction` 之外的方案（拖拽 + 删除靶区） | ⚠️ **非官方推荐**。官方《列表》规范明确推荐 `SwipeAction` 做横滑删除；项目改用 `onDragStart` + 靶区，属自选方案 |

---

## 5. 相关分技能

- [组件参考总目录](README.md) —— 证据分级约定、材质选型速查、跨组件强制约定
- [半模态抽屉](sheet.md) —— 抽屉内的章节 `List`、抽屉高度与内容滚动
- [圆形按钮与更多菜单](circle-button.md) —— 列表项右侧操作图标、视图切换按钮
- [沉浸光感材质](../immersive-material/README.md) —— 材质档位、生效范围、降级策略
- [官方设计规范数值表](../design-specs.md) —— §2 间距与栅格、§8 热区、§11 未证实清单
- [安全区与刘海避让](../immersive-material/safe-area.md) —— `getStatusBarHeightVp` / `getFloatingTabBottomVp` 的底层来源

**官方 API / 设计文档原文**：

- `references/huawei-docs/design-guides/list-0000001929853910.md`
- `references/huawei-docs/design-guides/convenient-life-0000001957252465.md`（宫格列数）
- `references/huawei-docs/architecture-guides/skeleton_screen-0000002294856764.md`
- `references/huawei-docs/harmonyos-faqs/faqs-arkui-705.md`（LazyForEach 骨架屏预加载）
- `references/huawei-docs/harmonyos-references/ts-container-list.md`
- `references/huawei-docs/harmonyos-references/ts-container-grid.md`
- `references/huawei-docs/harmonyos-references/ts-container-refresh.md`
- <https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-container-list>
