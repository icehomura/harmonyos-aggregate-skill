# 底部导航条（HdsTabs 浮动胶囊 + 迷你栏）

> **用途**：实现「底部四个 Tab 胶囊 + 右侧播放控制圆形」的导航条，以及点击圆形后
> **胶囊↔圆形互相形变**的交互。也给出**单页面应用（无导航条）**用圆形按钮承载
> 操作入口的等价做法。
>
> **最重要的结论先说**：**这个形变不是应用自绘的，是系统 `HdsTabs` 的 `miniBar`
> 机制托管的能力。** 应用只负责①配置 ②把系统上报的样式镜像成状态 ③渲染两种布局。
> 理解这一点，实现量会从「几百行动画代码」降到「几十行配置」。

---

## 目录

- [1. 结论速览](#1-结论速览)
- [2. 为什么不是自绘](#2-为什么不是自绘)
- [3. 三条件与完整配置](#3-三条件与完整配置)
- [4. barFloatingStyle 字段详解](#4-barfloatingstyle-字段详解)
- [5. 胶囊 ↔ 圆形形变机制](#5-胶囊--圆形形变机制)
- [6. 迷你栏两态实现](#6-迷你栏两态实现)
- [7. 尺寸数值表](#7-尺寸数值表)
- [8. 单页面应用：无导航条的等价做法](#8-单页面应用无导航条的等价做法)
- [9. 分段标签（顶部胶囊）](#9-分段标签顶部胶囊)
- [10. 版本降级](#10-版本降级)
- [11. 未证实清单](#11-未证实清单)
- [12. 相关分技能](#12-相关分技能)

---

## 1. 结论速览

| 问题 | 答案 | 出处 |
|---|---|---|
| 导航条容器是什么 | **系统 `HdsTabs`**（`@kit.UIDesignKit`） | `MainPage.ets:9,322` |
| 形变动画谁做的 | **系统 miniBar 机制**，应用不写动画 | `MainPage.ets:307-316` |
| 应用要做什么 | 配置 + **镜像系统上报的样式到状态** + 渲染两态布局 | `MainPage.ets:130` |
| 怎么主动展开 | `tabController.applyMiniBarStyle(HdsBarStyle.EXPAND)` | `MainPage.ets:265,278,287` |
| 收缩谁触发 | **系统在用户点击别的 Tab 时自发触发** | `MainPage.ets:135` |
| 升浮起的必要条件 | `barOverlap(true)` + `vertical(false)` + `barPosition(End)` | `MainPage.ets:363-365` |
| 沉浸光感怎么加 | `barFloatingStyle.systemMaterialEffect` | `MainPage.ets:301` |
| 页签栏底部间距 | `max(bottomSafe, 8) + 4` | `MainPage.ets:299` |
| 渐变蒙版高度 | `92` | `MainPage.ets:300` |
| 旧系统降级 | `barHeight(56 + safe)` + `barBackgroundColor(...)` | `HdsCompat.ets:41-42` |

---

## 2. 为什么不是自绘

**先确认一件事**：项目里**没有**任何手写的「胶囊变圆」宽度插值代码。

grep 结果：
- **0 处** `animateTo` 用于底栏宽度/圆角插值
- **0 处** `curves.springMotion` 用于底栏形变
- `MainPage.ets` 里的 `animateTo` 只用于**路由跳转**（`pushPathByName('player')`）

真正的机制在 `MainPage.ets:307-316`：

```ts
miniBar: (this.speechState.active || this.playerState.currentBook) ? {
  miniBarBuilder: () => this.miniBarBuilder(),
  enableMiniBarBackground: true,
  enableMiniBarClip: true,
  // 系统切换样式时同步给 MiniPlayer, 让它切换内部布局(折叠态只显示封面)
  onBarStyleChange: (miniStyle: HdsBarStyle, tabStyle: HdsBarStyle,
    miniBarWidth: number, tabBarWidth: number, mode: HdsTabsBarChangeMode) => {
    this.handleBarStyleChange(miniStyle, tabStyle, miniBarWidth, tabBarWidth, mode);
  }
} : undefined
```

> **`onBarStyleChange` 回调签名里的 `miniBarWidth` / `tabBarWidth` 就是证据** ——
> 宽度插值由系统算，应用拿到的是**结果值**（`MainPage.ets:129` 用 `_` 前缀明确表示不用）。

**实践含义**：你不能用普通 ArkTS 组件「复刻」这个动效的外壳。
宽度/圆角插值与圆形槽位由 `barFloatingStyle({ miniBar })` 在系统内部完成。
自绘方案只能自己写 `animateTo` 插值，且拿不到系统级的材质与手势联动。

---

## 3. 三条件与完整配置

### 必要条件（缺一不可）

```ts
.barOverlap(true)              // 页签栏悬浮于内容之上
.vertical(false)               // 横向
.barPosition(BarPosition.End)  // 贴底
```

> 官方原文：Tabs 悬浮样式需**同时**满足这三项，否则 `systemMaterial` 不生效。

### 完整骨架

```ts
import { HdsTabs, HdsTabsController, HdsBarStyle, HdsTabsBarChangeMode,
         HdsTabsFloatingStyle } from '@kit.UIDesignKit';

@Local currentTab: number = 0;
@Local miniBarCollapsed: boolean = false;          // ← 由系统回调写入
private tabController: HdsTabsController = new HdsTabsController();

build() {
  Stack({ alignContent: Alignment.Bottom }) {
    HdsTabs({ controller: this.tabController }) {
      TabContent() { HomePage({ ... }) }
        .tabBar(this.buildTabBar($r('sys.symbol.house_fill'), '首页'))
      TabContent() { ShelfPage({ ... }) }
        .tabBar(this.buildTabBar($r('sys.symbol.bookshelf'), '书架'))
      TabContent() { StatsPage({ ... }) }
        .tabBar(this.buildTabBar($r('sys.symbol.calendar_fill'), '记录'))
      TabContent() { ProfilePage({ ... }) }
        .tabBar(this.buildTabBar($r('sys.symbol.person_fill'), '我的'))
    }
    .barOverlap(true)
    .barPosition(BarPosition.End)
    .vertical(false)
    // 浮动样式经 AttributeModifier 注入（内含 API 降级分支）
    .attributeModifier(new CompatibleTabsModifier(this.floatingBarStyle(), 56 + this.bottomSafeVp))
    .onChange((index: number) => { this.currentTab = index; })
    .onTabBarClick((index: number) => { /* 双击回顶判定 */ })
    .animationDuration(300)
    .width('100%').height('100%')
    .backgroundColor(HomeTheme.BgNeutral)
    // 背景延伸到状态栏与手势区
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
  }
  .width('100%').height('100%')
}
```
出处：`MainPage.ets:320-418`

### TabBar 图标构造

```ts
private buildTabBar(icon: Resource, label: string): BottomTabBarStyle {
  return new BottomTabBarStyle(
    {
      normal: new SymbolGlyphModifier(icon)
        .fontColor([$r('sys.color.font_primary')]).fontSize(24),
      selected: new SymbolGlyphModifier(icon)
        .fontColor([AppColor.Brand]).fontSize(26),      // 选中放大到 26
    },
    label
  ).labelStyle({
    unselectedColor: $r('sys.color.font_primary'),
    selectedColor: AppColor.Brand,
  });
}
```
出处：`MainPage.ets:240-251`

> **选中态用主题色**，未选中用 `font_primary`。图标 24→26fp 形成轻微放大反馈。

---

## 4. barFloatingStyle 字段详解

```ts
private floatingBarStyle(): HdsTabsFloatingStyle | undefined {
  if (!PlatformCompat.floatingTabs) return undefined;      // API < 23 返回 undefined
  return {
    // ① 与屏幕底部的距离：安全区 + 4
    barBottomMargin: Math.max(this.bottomSafeVp, FLOATING_MIN_SAFE_BOTTOM) + FLOATING_BOTTOM,

    // ② 渐变蒙版：颜色 + 高度
    gradientMask: { maskColor: $r('app.color.floating_bar_mask'), maskHeight: 92 },

    // ③ 沉浸光感（HDS 侧，自适应档位）
    systemMaterialEffect: HdsCompat.adaptiveMaterial,

    // ④ 光感颜色跟随主题色
    lightColor: AppColor.Brand,

    // ⑤ 智感握姿：宽屏左右手自动跟随
    adaptToHandedness: true,

    // ⑥ 迷你栏配置
    miniBar: (this.speechState.active || this.playerState.currentBook) ? {
      miniBarBuilder: () => this.miniBarBuilder(),
      enableMiniBarBackground: true,
      enableMiniBarClip: true,
      onBarStyleChange: (miniStyle, tabStyle, miniBarWidth, tabBarWidth, mode) => {
        this.handleBarStyleChange(miniStyle, tabStyle, miniBarWidth, tabBarWidth, mode);
      }
    } : undefined
  };
}
```
出处：`MainPage.ets:296-318`

| 字段 | 类型 | 作用 | 项目取值 |
|---|---|---|---|
| `barBottomMargin` | number | 页签栏与屏幕底部距离 | `max(bottomSafe, 8) + 4` |
| `gradientMask` | `{ maskColor, maskHeight }` | 底部渐变蒙版，让内容淡出 | 高 **92**，色 `floating_bar_mask` |
| `systemMaterialEffect` | `SystemMaterialParams` | **沉浸光感**（HDS 侧） | `{ ADAPTIVE, ADAPTIVE }` |
| `lightColor` | `ResourceColor` | 光感高光色 | `AppColor.Brand`（跟随主题色） |
| `adaptToHandedness` | boolean | 智感握姿左右跟随 | `true` |
| `miniBar` | object | **迷你栏**（播放控制圆形） | 见下节 |

> `systemMaterialEffect` 用 `hdsMaterial.MaterialType.ADAPTIVE` +
> `MaterialLevel.ADAPTIVE` —— 官方推荐写法，由系统按设备性能自适应。
> 详见 [../immersive-material/README.md](../immersive-material/README.md)。

---

## 5. 胶囊 ↔ 圆形形变机制

### 三个角色

```
        ┌─────────────────────────────┐   ┌──────────┐
展开态  │  首页  书架  记录  我的      │ + │ ● 播放   │  Tab 胶囊 + MiniBar 胶囊
        └─────────────────────────────┘   └──────────┘
                        ↓ 用户点击 MiniBar 内的封面/展开
        ┌─────┐   ┌──────────────────────────────┐
折叠态  │  ●  │ + │ 封面  书名 / 章节   ▶ ⏭      │  当前 Tab 缩成圆形 + MiniBar 展开成胶囊
        └─────┘   └──────────────────────────────┘
```
> 出处（项目内注释）：`MainPage.ets:253-258`
> 「折叠态(COLLAPSE): 显示一个圆形播放控制按钮
>  展开态(EXPAND): 显示完整的 MiniPlayer」

### 应用层的三件事

**① 镜像系统状态**（最关键的一行）

```ts
private handleBarStyleChange(miniStyle: HdsBarStyle, tabStyle: HdsBarStyle,
  _miniBarWidth: number, _tabBarWidth: number, mode: HdsTabsBarChangeMode): void {
  this.miniBarCollapsed = miniStyle === HdsBarStyle.COLLAPSE;   // ← 唯一状态来源
  if (tabStyle === HdsBarStyle.EXPAND) {
    this.restoreTabBarOnWindowGrow = false;
    return;
  }
  if (mode === HdsTabsBarChangeMode.USER_CLICK) {
    // 记录用户主动折叠时的窗口尺寸，供窗口变大时恢复
    this.restoreTabBarOnWindowGrow = true;
    this.tabCollapseViewportWidth = this.viewportWidth;
    this.tabCollapseViewportHeight = this.viewportHeight;
  }
}
```
出处：`MainPage.ets:128-140`

> **应用不产生形变，只读取系统上报的 `miniStyle` 并镜像到 `@Local`。**
> `miniBarCollapsed` 再传给 `MiniPlayer`，让它切换内部布局。

**② 主动展开（命令式）**

```ts
onTapBody: () => {
  // 折叠态：点击封面 → 展开迷你栏（不进播放器）；展开态：进播放器
  if (PlatformCompat.floatingTabs && this.miniBarCollapsed) {
    this.tabController.applyMiniBarStyle(HdsBarStyle.EXPAND);   // ← 主动展开
  } else {
    this.navigateToPlayer();
  }
},
```
出处：`MainPage.ets:275-282`（`onExpand` 同构，见 `:285-291`）

> **只有"展开"有主动 API**。反向（胶囊→圆形）没有对应的 `applyMiniBarStyle(COLLAPSE)`
> 调用 —— 那是**系统在用户点击其它 Tab 时自发触发**的。这也解释了
> `HdsTabsBarChangeMode.USER_CLICK` 这个枚举的存在（`MainPage.ets:135`）。

**③ 渲染两态内容**

```ts
@Builder
miniBarBuilder(): void {
  if (this.speechState.active) {
    SpeechMiniPlayer({ state: this.speechState, collapsed: this.miniBarCollapsed, ... })
  } else if (this.playerState.currentBook) {
    MiniPlayer({
      playerState: this.playerState,
      collapsed: this.miniBarCollapsed,      // ← 形态开关
      onTapBody: () => { ... },
      onToggle: () => AudioService.getInstance().toggle(),
      onNext: () => this.playNext(),
      onExpand: () => { ... },
    })
  }
}
```
出处：`MainPage.ets:259-294`

> **`miniBar` 为 `undefined` 时不显示迷你栏**（无播放内容时）。

---

## 6. 迷你栏两态实现

`MiniPlayer` 是**完全受控组件**：无 `@Local`，形态由 `@Param collapsed` 决定。

```ts
@ComponentV2
export struct MiniPlayer {
  @Param playerState: PlayerState = new PlayerState();
  @Param collapsed: boolean = true;              // ← 形态开关
  @Event onTapBody: () => void = () => {};
  @Event onToggle: () => void = () => {};
  @Event onNext: () => void = () => {};
  @Event onExpand: () => void = () => {};
```
出处：`MiniPlayer.ets:4-11`

### 两态的差异点

| 元素 | 折叠态（圆形） | 展开态（胶囊） | 出处 |
|---|---|---|---|
| `Row` 间距 | `0` | `AppSpace.Sm`(12) | `MiniPlayer.ets:62` |
| 封面容器宽高 | `'100%'` | `44` | `MiniPlayer.ets:85-86` |
| 封面圆角 | `999`（圆） | `22`（超椭圆方角） | `MiniPlayer.ets:81` |
| 内层封面 | `92% × 92%`（给外圈进度环留 8%） | 同 | `MiniPlayer.ets:79-80` |
| 标题 / 章节 | **不挂载** | 14fp Medium / 12fp | `MiniPlayer.ets:97-115` |
| 播放/下一集按钮 | **不挂载** | 24fp / 22fp | `MiniPlayer.ets:117-130` |
| 内边距 | `0 / 0` | 左 8 / 右 16 | `MiniPlayer.ets:135-138` |

**关键实现点**：

```ts
// ① 共享元素转场（唯一一处）
.geometryTransition('player-cover')

// ② 展开内容条件挂载（不是 opacity:0）—— 折叠态整棵子树不创建，零开销
if (!this.collapsed) {
  Column({ space: 2 }) { /* 书名 + 章节 */ }
  SymbolGlyph(/* 播放/暂停 */)
  SymbolGlyph(/* 下一集 */)
}

// ③ 阻止事件冒泡 —— 否则点播放键会误触"进播放器"
.hitTestBehavior(HitTestMode.Block)
```
出处：`MiniPlayer.ets:87, 97, 121`

### 进度环（折叠态的视觉核心）

```ts
Progress({ value: this.chapterProgressPercent, total: 100, type: ProgressType.Ring })
  .color(AppColor.Brand)
  .backgroundColor(HomeTheme.ProgressTrack)
  .style({
    strokeWidth: 1.5,              // 细环
    enableSmoothEffect: false,     // 关掉平滑，避免频繁绘制
    enableScanEffect: false,
    shadow: false,
  })
```
出处：`MiniPlayer.ets:63-74`

> **封面保持静止不旋转**，外圈 1.5vp 细环展示当前集进度。
> 百分比用 `@Computed` 派生，`durationMs <= 0` 时回退 `savedDurationMs`
> （防切书瞬间进度归零），并 clamp 到 0–100（`MiniPlayer.ets:13-21`）。

---

## 7. 尺寸数值表

### 应用显式设定的（可精确复刻）

| 元素 | 数值 | 出处 |
|---|---|---|
| 浮动栏降级高度（API 20–22） | `56 + bottomSafeVp` | `MainPage.ets:366` |
| 栏底部外边距 | `max(bottomSafeVp, 8) + 4` | `MainPage.ets:299` |
| 渐变蒙版高度 | **92** | `MainPage.ets:300` |
| 渐变蒙版颜色 | 浅 `#66F1F3F5` / 深 `#661A1A1A` | `resources/*/element/color.json` |
| 内容需预留的底部高度 | `bottomSafe + 4 + 60 + 12` | `WindowUtils.ets:193-210` |
| TabBar 图标（普通 / 选中） | **24 / 26** fp | `MainPage.ets:243-244` |
| 迷你栏封面（折叠 / 展开） | `'100%'` / **44×44** | `MiniPlayer.ets:85-86` |
| 封面内圆 | **92%** | `MiniPlayer.ets:79-80` |
| 封面圆角（折叠 / 展开） | **999 / 22** | `MiniPlayer.ets:81` |
| 进度环线宽 | **1.5** | `MiniPlayer.ets:70` |
| 书名 / 章节 / 播放键 / 下一集 | **14 / 12 / 24 / 22** fp | `MiniPlayer.ets:100,107,119,126` |
| 降级迷你栏容器 | 高 64、宽 92%、圆角 24、底边距 `64 + safe` | `MainPage.ets:393-399` |

> 底部预留高度的常量定义：`FLOATING_BOTTOM = 4`、`FLOATING_TAB_HEIGHT = 60`、
> `FLOATING_GAP = 12`（`WindowUtils.ets:194-196`），兜底底部安全区 24vp（`:23`）。

### 系统托管的（代码里读不到）

| 元素 | 说明 |
|---|---|
| 胶囊高度 | 由 `HdsTabs` 按 `barFloatingStyle` 自行决定 |
| 圆形直径 | 同上 |
| 胶囊↔圆形插值的时长与曲线 | 同上 |
| 圆形里显示什么 | 由 `miniBarBuilder` 决定（这是应用可控的） |

> ⚠️ 这些数值来自系统 SDK `@kit.UIDesignKit`，**不在工程代码中**。
> 官方设计规范给出的相关值是：悬浮式底部页签**高度统一 56vp**、图标 **24×24vp**、
> 容器最大宽 **328vp（4 tabs）/ 360vp（≥5 tabs）**。
> 见 [../design-specs.md](../design-specs.md#4-底部页签)。

---

## 8. 单页面应用：无导航条的等价做法

> 场景：录音机、计时器这类**只有一个主页面、不设底部导航条**的应用。
> 官方**没有**针对此类应用的专章规范（「简易应用」**不是官方术语**）。

### 官方框架下的定位

官方按「应用架构」分类（底部页签 / 侧边页签 / 分栏 / 侧边导航栏）。
不设底部导航条属于**「不使用底部页签导航的单页面 / 工具型架构」**，
应遵循以下**由官方章节推导的组合准则**（非单一官方出处）：

| # | 准则 | 官方依据 |
|---|---|---|
| 1 | **标题栏** 56vp 单行 / 112vp 强调型；操作项过多时用「更多」图标收进菜单 | titlebar 规范 |
| 2 | **工具栏** 52vp，最多 4 个操作 + 1 个更多；**不允许只有「更多」或仅一个操作** | toolbar 规范 |
| 3 | **核心操作栏**（悬浮页面下方，带模糊材质和投影） | `HdsActionBar` |
| 4 | **底部抬高避让 28vp** | 导航条规范 |
| 5 | **热区 ≥ 48×48vp 推荐 / ≥ 40×40vp 必须** | UX 标准 2.1.3.3 |
| 6 | **除一级界面外，所有全屏界面需提供返回/关闭/取消按钮** | UX 标准 2.1.1.1（必须级） |

### 右上角圆形按钮（材质版）

```ts
// 标题栏右侧的圆形"更多"按钮
Stack({ alignContent: Alignment.Center }) {
  SymbolGlyph($r('sys.symbol.list_bullet'))     // 注意：官方无 more_vert 图标
    .fontSize(22)
    .fontColor([$r('sys.color.icon_primary')])
}
.width(40).height(40)                            // 视觉 40，热区需 ≥40（推荐 48）
.borderRadius(AppRadius.Pill)                     // 999 → 圆形
.backgroundColor(Color.Transparent)               // 不能是实色，否则遮住材质
.attributeModifier(AppMaterial.modifier(AppMaterial.InteractiveClean))
.clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.94 })
.onClick(() => { /* 打开更多菜单 */ })
```

**配套菜单**（≤7 项且无需滚动时优先 `bindMenu`，而非抽屉）：

```ts
@Builder
buildMoreMenu() {
  Menu() {
    MenuItem({ content: '排序' }).onClick(() => { /* ... */ })
    MenuItem({ content: '设置' }).onClick(() => { /* ... */ })
    MenuItemGroup({ header: '筛选' }) {
      MenuItem({ content: '仅未完成' }).onClick(() => { /* ... */ })
    }
  }
}

// 挂在按钮上
.bindMenu(this.buildMoreMenu())
```
出处：`RuleSourcePage.ets:1479-1485, 1562-1593`

**「更多」该用哪种形态**：

| 场景 | 做法 | 出处 |
|---|---|---|
| 菜单项 ≤ 7 且无需滚动 | `bindMenu` 下拉菜单 | `RuleSourcePage.ets:1485` |
| 需要搜索/滚动/复杂布局 | `bindSheet` 半模态抽屉 | [sheet.md](sheet.md) |
| 需要整页承载 | `pushPathByName` 独立页 | `BlockMorePage` |

### 图标选择提醒

项目与官方 Symbol 集里**都没有** `more_vert` / `more_horiz` / 三点图标。
「更多」统一用 **`sys.symbol.list_bullet`**（列表图标），
`accessibilityText` 设为「更多」类文案（`RuleSourcePage.ets:1483`）。

---

## 9. 分段标签（顶部胶囊）

顶部（或标题栏 `bottomBuilder` 内）的「全部 / 有声书 / 电子书」这类分段切换，
与底部导航条**完全不复用**，是两套独立实现：

| | 底部导航条 | 分段标签 |
|---|---|---|
| 组件 | `HdsTabs`（`@kit.UIDesignKit`） | `CapsuleSegmentButtonV2`（`@kit.ArkUI`）或自绘 |
| 位置 | 屏幕底部悬浮 | 页面**顶部**标题栏下方 |
| 材质 | `barFloatingStyle.systemMaterialEffect` | `backgroundSystemMaterial: AppMaterial.FloatingControl` |
| 指示器 | 系统绘制 | **手工叠加** 18×2 圆角条 |

### 官方组件版（书架）

```ts
CapsuleSegmentButtonV2({
  items: this.shelfFilterItems,
  selectedIndex: this.shelfFilter,
  $selectedIndex: (index: number): void => this.selectShelfFilter(index),
  itemFontSize: LengthMetrics.fp(13),
  itemSelectedFontColor: ColorMetrics.resourceColor(HomeTheme.Accent),
  itemSelectedBackgroundColor: ColorMetrics.resourceColor(Color.Transparent),
  itemMinHeight: LengthMetrics.vp(34),
  buttonMinHeight: LengthMetrics.vp(38),
  buttonPadding: LengthMetrics.vp(2),
  backgroundSystemMaterial: AppMaterial.FloatingControl,   // ← 沉浸光感
})
```
配套手绘下划线（`hitTestBehavior(None)` 防止拦截点击）：
出处：`FavoritePage.ets:1025-1068`

```ts
Row() {                                    // 叠加在按钮之上
  ForEach([0, 1, 2], (index: number) => {
    Column() {
      Row().width(18).height(2).borderRadius(1)
        .backgroundColor(HomeTheme.Accent)
        .opacity(this.shelfFilter === index ? 1 : 0)
    }.layoutWeight(1)
  })
}
.padding({ left: 2, right: 2, bottom: 4 })
.hitTestBehavior(HitTestMode.None)         // ← 关键：不拦截点击
```

### 自绘版（首页分类栏）

`ImmersiveTabComponent`：34vp 高胶囊 + 30vp 文字行 + 18×2 下划线，
选中/未选中用 `AppMotion.Fast`(150ms) 过渡文字色，
下划线用 `AppCurve.Spring`(250ms) 做 `scale.x 0.35→1` 展开。
出处：`ImmersiveTabComponent.ets:13-54`

> 两处指示器规格一致（18×2、圆角 1）但**各自实现，未抽公共组件**——
> 复刻时可统一为一个组件。

---

## 10. 版本降级

`HdsTabs` 浮动样式与迷你栏从 **API 23** 起支持。旧系统走 `AttributeModifier` 分支：

```ts
export class CompatibleTabsModifier implements AttributeModifier<HdsTabsAttribute> {
  applyNormalAttribute(instance: HdsTabsAttribute): void {
    if (PlatformCompat.floatingTabs && this.style !== undefined) {
      instance.barFloatingStyle(this.style);            // API ≥ 23：浮动胶囊 + 材质
    } else {
      instance.barHeight(this.fallbackHeight)            // API 20–22：固定底栏
        .barBackgroundColor($r('sys.color.comp_background_primary'));
    }
  }
}
```
出处：`HdsCompat.ets:28-45`

**降级时的迷你栏**：项目用独立 `Stack` 手写（`MainPage.ets:389-400`）：

```ts
if (!PlatformCompat.floatingTabs && (this.speechState.active || this.playerState.currentBook)) {
  Column() { this.miniBarBuilder() }
    .height(64).width('92%')
    .backgroundColor($r('sys.color.comp_background_primary'))
    .backgroundBlurStyle(BlurStyle.COMPONENT_REGULAR)
    .borderRadius(24).clip(true)
    .margin({ bottom: 64 + this.bottomSafeVp })
}
```

> **降级时不调用任何 `hdsMaterial` 接口**，避免在 API 20–22 上触碰不存在的模块。

---

## 11. 未证实清单

| # | 条目 | 状态 |
|---|---|---|
| 1 | 「同宿主节点连续 `bindSheet` 会覆盖」 | 仅项目源码注释（`ReaderPage.ets:1329`），官方文档未述 |
| 2 | 胶囊/圆形的系统插值时长与曲线 | 系统内部实现，代码与官方文档均未给出 |
| 3 | `enableMiniBarBackground` / `enableMiniBarClip` 的精确语义 | 官方 SDK 有字段，本地文档未查到逐字定义 |
| 4 | 「简易应用」为官方分类 | ❌ **非官方术语**，已核实官方全站搜索 0 命中 |
| 5 | 官方 Symbol 集是否存在 `more_vert` | 本地文档库检索 0 命中，无法确认存在或不存在 |
| 6 | `restoreTabBarOnWindowGrow` 的窗口尺寸阈值 | 项目自定义逻辑，非官方 |
| 7 | 双击 Tab 回顶的 300ms 判定窗口 | 项目实现（`APP_UI.md:9`），非官方数值 |

---

## 12. 相关分技能

- 材质体系与 API 版本分流 → [../immersive-material/README.md](../immersive-material/README.md)
- 圆形按钮完整写法与尺寸普查 → [circle-button.md](circle-button.md)
- 半模态抽屉（「更多」的另一种形态） → [sheet.md](sheet.md)
- 官方设计规范数值（页签高度/容器宽度/热区） → [../design-specs.md](../design-specs.md)
- 安全区与底部避让 → [../immersive-material/safe-area.md](../immersive-material/safe-area.md)
