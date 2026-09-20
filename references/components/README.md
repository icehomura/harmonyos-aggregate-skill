# 组件参考（references/components/）

本目录是「沉浸光感应用」的**组件级实现参考**：每个组件给出 **官方 API 规范**、
**项目实测写法（带 `文件:行号` 出处）**、以及**未证实项清单**。

> 与 [../design-specs.md](../design-specs.md) 的分工：
> `design-specs.md` 是**官方数值表**（圆角/间距/字号/热区，全部带官方 URL）；
> 本目录是**组件怎么落地**（API 参数、宿主约束、材质注入点、代码骨架）。
> 遇到"这个数值是多少"→ 查 `design-specs.md`；遇到"这个组件怎么写"→ 查本目录。

---

## 目录

- [子文档索引](#子文档索引)
- [证据分级约定](#证据分级约定)
- [证据来源](#证据来源)
- [跨组件强制约定](#跨组件强制约定)
- [材质选型速查](#材质选型速查)
- [相关分技能](#相关分技能)

---

## 子文档索引

| 文件 | 覆盖组件 | 何时读 |
|---|---|---|
| [navigation.md](navigation.md) | **底部导航条** `HdsTabs` 浮动胶囊、**胶囊↔圆形形变**、MiniBar、顶部栏适配、单页面应用的等价做法 | 做底部导航、播放控制迷你栏、无导航条的单页面应用 |
| [sheet.md](sheet.md) | 半模态抽屉 `bindSheet`、`systemMaterial` 材质弹层、自绘关闭按钮 | 做阅读设置面板、章节列表、播放速度/定时/跳过片头、外观选择弹层 |
| [circle-button.md](circle-button.md) | 圆形按钮（40/44/36/34vp）、图标按钮、`bindMenu`「更多」菜单、顶部栏适配 | 做标题栏操作项、悬浮控件、排序/视图切换、"更多"入口 |
| [lists.md](lists.md) | `List` / `Grid` / `LazyForEach` / 骨架屏 / `Refresh` 下拉刷新 / 断点自适应 | 做首页书单、书架三列、搜索结果、加载占位、空态/错误态 |

> **底部导航条（`HdsTabs` 浮动胶囊 + MiniBar 胶囊↔圆形形变）是系统能力，不是自绘** ——
> 完整机制见 [navigation.md](navigation.md) 第 5 节。

---

## 证据分级约定

本目录所有陈述按来源分三类，**必须区分**：

| 标记 | 含义 | 判定方式 |
|---|---|---|
| **【官方规范】** | 华为官方文档/UX 标准原文 | 给出官方 URL 或本地副本路径 |
| **【项目实践】** | 真实工程代码里的既定写法 | 给出 `文件:行号`（相对项目根） |
| **⚠️ 未证实** | 未找到官方文本文依据 | 显式标注，**不得当规范引用** |

官方规范与项目实践**可能不一致**（例如项目为兼容 API 20 而偏离官方默认值）。
两者冲突时：**以官方规范为准判断"对不对"，以项目实践为准判断"能不能跑"**。

---

## 证据来源

### 1. 真实工程源码

根目录：`C:\Users\icehomura\workspace\arkts\HarmonyOS-book`
（下文所有 `文件:行号` 均相对该根的 `entry/src/main/ets/`）

关键文件：

| 文件 | 行数 | 用途 |
|---|---|---|
| `pages/MainPage.ets` | 455 | `HdsTabs` 底部导航条宿主 + MiniBar 接线 |
| `components/MiniPlayer.ets` | 141 | 迷你栏内容（折叠/展开两态） |
| `components/ImmersiveTabComponent.ets` | 56 | 分段标签（胶囊 + 手绘下划线） |
| `utils/HdsCompat.ets` | 45 | HdsTabs 悬浮样式与 API 降级 |
| `utils/PlatformCompat.ets` | 39 | 设备能力分流（API 22/23/26） |
| `components/ReaderSettingsSheet.ets` | 589 | 阅读设置抽屉（最完整的抽屉内容样板） |
| `pages/ReaderPage.ets` | 1804 | 3 个抽屉、独立宿主节点 |
| `pages/PlayerPage.ets` | 1836 | 4 个抽屉、圆形按钮 |
| `theme/Theme.ets` | 317 | `AppMaterial` / `AppRadius` / `AppSpace` / `AppFont` 令牌 |
| `utils/AdaptiveLayout.ets` | 59 | 手机窗口断点 |

### 2. 官方文档本地副本

根目录：`C:\Users\icehomura\workspace\arkts\harmonyos-aggregate-skill\references\huawei-docs\`

在**技能包根目录**运行检索：

```bash
node scripts/search-docs.mjs "bindSheet" --catalog harmonyos-references
node scripts/search-docs.mjs "底部页签" --catalog design-guides
node scripts/search-docs.mjs "骨架屏"
```

本目录高频引用的官方文档：

| 路径 | 内容 |
|---|---|
| `harmonyos-references/ui-design-hdstabs.md` | `HdsTabs` / `HdsTabsFloatingStyle` / `HdsTabsMiniBar` 权威 API |
| `harmonyos-references/ts-universal-attributes-sheet-transition.md` | `bindSheet` / `SheetOptions` / `SheetSize` / `SheetType` |
| `harmonyos-references/ts-container-refresh.md` | `Refresh` / `refreshOffset` / `pullToRefresh` / `onRefreshing` |
| `design-guides/bindsheet-0000001956852753.md` | 半模态设计规范（档位、形态、沉浸光感） |
| `design-guides/bottomtab-0000001956787789.md` | 底部页签设计规范（平铺/悬浮、MiniBar 布局） |
| `design-guides/button-0000001929683228.md` | 按钮规范（含圆形按钮） |
| `design-guides/list-0000001929853910.md` | 列表规范（信息层次、行高、横滑） |
| `design-guides/ux-guidelines-general-0000001760708152.md` | UX 体验标准（2.1.3.3 点击热区） |
| `architecture-guides/skeleton_screen-0000002294856764.md` | 官方骨架屏实现思路 |

---

## 跨组件强制约定

这些在真实工程里**没有例外**，来自官方文档与项目踩坑：

1. **材质只有一个入口。** 不得内联 `systemMaterial` 参数，统一经
   `AppMaterial.modifier(...)` 或 `AppMaterial.<X>` 取用
   （`theme/Theme.ets:55-166`）。否则外观设置无法全局生效。
2. **`systemMaterial` 必须放在其他样式属性之后设置**，否则样式异常。
3. **设了材质就不要再设 `backgroundColor` / `backgroundBlurStyle` / 边框**，
   会遮挡材质。需要透出材质时用 `Color.Transparent`。
4. **同一子树只在外层设一次材质**，内层不得嵌套。
5. **ArkUI V2 只用 V2 装饰器**：`@ComponentV2 / @Local / @Param / @Event / @Computed`。
   全项目 **0 处 V1 混用**。
6. **长列表必须 `LazyForEach` + 稳定业务 key**，不得用 index 作 key。
7. **点击热区不得小于 40×40vp**（官方 UX 标准 2.1.3.3，必须级）；
   推荐 48×48vp。
8. **所有加载指示器必须显式设置品牌色**，不得用系统默认蓝。
9. **全项目 0 处 `hoverEffect`**——悬浮反馈一律用
   `clickEffect({ level: ClickEffectLevel.LIGHT, scale: ... })`。
   （实测：`grep -rn "hoverEffect" entry/src/main/ets` → 0 命中）

---

## 材质选型速查

来自 `theme/Theme.ets:93-136`，**都是 `uiMaterial.Material`，API 26 起生效**
（`PlatformCompat.immersiveMaterial`，`utils/PlatformCompat.ets:9-11`）：

| 令牌 | `ImmersiveStyle` | shadow | interactive | invert | 典型用途 |
|---|---|---|---|---|---|
| `AppMaterial.InteractiveClean` | `THIN` | ✗ | ✓ | **✓** | 圆形按钮、分段标签、搜索框（前景色反色） |
| `AppMaterial.InteractiveThin` | `THIN` | ✗ | ✓ | ✗ | 可交互薄材质 |
| `AppMaterial.SurfaceClean` | `THIN` | ✗ | ✗ | ✗ | 静态表面 |
| `AppMaterial.FloatingControl` | `ULTRA_THIN` | ✓ | ✓ | ✗ | 深色场景悬浮控件、分段按钮容器 |
| `AppMaterial.Sheet` / `PlayerSheet` | `THIN` | ✓ | ✗ | ✗ | **播放类**弹层（跟随外观档位） |
| `AppMaterial.ReaderSheetThick` | `THICK`（**固定**） | ✓ | ✗ | ✗ | **阅读类**弹层（不跟随外观档位） |
| `AppMaterial.ReaderBar` | `THIN`（**固定**） | ✓ | ✗ | ✗ | 阅读页底部悬浮胶囊栏 |
| `AppMaterial.DialogUltraThick` | `ULTRA_THICK` | ✓ | ✗ | ✗ | 深色玻璃弹层表面 |

`AppMaterial.material(...)` 的 `fixedStyle = true` 表示**忽略外观设置的厚度档位**，
强制用传入的 `fallback` 档位（`theme/Theme.ets:83`）。

**降级**（API 20–25，`PlatformCompat.immersiveMaterial === false`）：
所有材质 getter 返回 `undefined`，`CompatibleMaterialModifier` 回落到
`backgroundColor(fallbackColor) + backgroundBlurStyle(fallbackBlur)`
（`theme/Theme.ets:183-192`）。

---

## 相关分技能

- [沉浸光感材质](../immersive-material/README.md) —— `uiMaterial` / `hdsMaterial` 两套 API、档位、生效范围铁律
- [官方设计规范数值表](../design-specs.md) —— 圆角/间距/字号/热区官方数值与出处
- [安全区与刘海避让](../immersive-material/safe-area.md) —— `AvoidArea` API、沉浸式全屏、标题栏避让
- `references/theming/`（**尚未落地**）—— 主题模式、材质档位、主题色、启动页
- 官方文档全文检索：`node scripts/search-docs.mjs "关键词"`

---

> 本目录所有结论均可回溯到上列源码行号或官方文档路径。
> 标注「⚠️ 未证实」的条目**不要当规范使用**；若你在官方文档中找到依据，
> 请补上出处并把标记改为「官方规范」。
