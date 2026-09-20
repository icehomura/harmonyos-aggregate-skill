# 半模态抽屉（bindSheet）

> **用途**：用系统 `bindSheet` 搭出「沉浸光感材质抽屉」——阅读设置面板、章节目录、
> 播放速度 / 定时关闭 / 跳过片头、外观（材质档位 / 主题色）选择。
> 本文给出官方 `bindSheet` 规范、项目里 10 处抽屉的实测参数、以及**宿主节点**这个
> 最容易踩的坑。

---

## 目录

- [1. 结论速查](#1-结论速查)
- [2. 官方规范](#2-官方规范)
  - [2.1 bindSheet 签名与硬约束](#21-bindsheet-签名与硬约束)
  - [2.2 SheetOptions 关键字段](#22-sheetoptions-关键字段)
  - [2.3 SheetSize / SheetType 枚举](#23-sheetsize--sheettype-枚举)
  - [2.4 设计规范：档位与形态](#24-设计规范档位与形态)
  - [2.5 沉浸光感与 systemMaterial](#25-沉浸光感与-systemmaterial)
- [3. 项目实践](#3-项目实践)
  - [3.1 十个抽屉的全量参数表](#31-十个抽屉的全量参数表)
  - [3.2 铁律：不同弹层必须挂不同宿主节点](#32-铁律不同弹层必须挂不同宿主节点)
  - [3.3 材质选型：阅读类 vs 播放类](#33-材质选型阅读类-vs-播放类)
  - [3.4 showClose: false → 必须自绘关闭按钮](#34-showclose-false--必须自绘关闭按钮)
  - [3.5 内容根节点不写任何背景属性](#35-内容根节点不写任何背景属性)
  - [3.6 控件底用半透明 tint，不用实色](#36-控件底用半透明-tint不用实色)
  - [3.7 文字型按钮显式去掉默认灰底](#37-文字型按钮显式去掉默认灰底)
  - [3.8 生命周期：onAppear / onDisappear / onWillDismiss](#38-生命周期onappear--ondisappear--onwilldismiss)
  - [3.9 返回键拦截](#39-返回键拦截)
  - [3.10 抽屉内容骨架模板](#310-抽屉内容骨架模板)
- [4. 未证实清单](#4-未证实清单)
- [5. 相关分技能](#5-相关分技能)

---

## 1. 结论速查

| 结论 | 类型 | 出处 |
|---|---|---|
| 全项目 **10 处 `.bindSheet(` 调用**，**0 处 `bindContentCover`** | 项目实践 | `grep` 实测（见 3.1） |
| **不同弹层必须挂不同宿主节点**；同一节点连续 `bindSheet` 会互相覆盖 | 项目实践 | `pages/ReaderPage.ets:1329`（源码注释） |
| 阅读类抽屉用 `AppMaterial.ReaderSheetThick`（**固定 THICK**，不跟随外观设置） | 项目实践 | `theme/Theme.ets:121-125` |
| 播放类抽屉用 `AppMaterial.PlayerSheet`（= `AppMaterial.Sheet`，跟随外观设置） | 项目实践 | `theme/Theme.ets:109-115` |
| `showClose: false` → **必须自绘关闭按钮** | 项目实践 | `pages/PlayerPage.ets:1248` + `1497-1506` |
| **抽屉内容根节点不写任何背景属性**，靠原生材质透出 | 项目实践 | `components/ReaderSettingsSheet.ets:586-587` |
| 官方：设了 `systemMaterial` 就**不建议**再设 `backgroundColor` / `borderColor` / `borderWidth` / `shadow` | 官方规范 | `ts-universal-attributes-sheet-transition.md:133` |
| 官方：材质不自带背景时**建议 `backgroundColor: Color.Transparent`** | 官方规范 | 同上 doc 示例 10（`…:1052` 注释） |
| `systemMaterial` **起始版本 26.0.0** | 官方规范 | `ts-universal-attributes-sheet-transition.md:133` |
| 全项目 **0 处 `hoverEffect`** | 项目实践 | `grep` 实测 |

---

## 2. 官方规范

### 2.1 bindSheet 签名与硬约束

【官方规范】出处：`references/huawei-docs/harmonyos-references/ts-universal-attributes-sheet-transition.md`

```
bindSheet(isShow: boolean, builder: CustomBuilder, options?: SheetOptions): T
```

> 给组件绑定半模态页面，通过 isShow 参数控制半模态页面的显示与隐藏，
> builder 参数配置半模态页面的内容，options 参数配置半模态页面的可选属性。

四条硬约束（同上文档「### bindSheet」小节）：

1. **该接口不支持在 `attributeModifier` 中调用。**
2. **`isShow` 必须双向绑定。** 非双向绑定情况下，以拖拽方式关闭半模态页面
   不会改变 `isShow` 的值。建议用 `$$`（API 10+）或 `!!`（API 18+）。
   项目统一用 `$$`：`.bindSheet($$this.showXXX, ...)`。
3. **半模态严格和宿主节点绑定。** 宿主节点还没上树就把 `isShow` 置 true，
   半模态**不生效**。想「页面显示瞬间就弹出」请用 `onAppear` 确保已挂载。
   （`SheetMode.EMBEDDED` 时还要确保页面节点也挂载成功。）
4. **离场动效不支持打断。** 视觉上已消失但动效未结束时，再点拉起**不会响应**。

### 2.2 SheetOptions 关键字段

【官方规范】同上文档「### SheetOptions / ### BindOptions」。

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `height` | `SheetSize \| Length` | `LARGE` | 底部弹窗竖屏最大高度 = 距状态栏 8vp；设了 `detents` 则本属性无效 |
| `detents` | `[SheetSize\|Length, …]` | — | 多档位。跟手滑动切换，速度阈值 1000px/s，距离阈值 50% |
| `preferType` | `SheetType` | 见下 | 宽度 <600vp 默认底部；600–840 默认居中；≥840 默认跟手 |
| `showClose` | `boolean \| Resource` | **`true`** | 是否显示关闭图标。**全屏模态（`CONTENT_COVER`）下不支持，设置无效** |
| `dragBar` | `boolean` | 视 `detents` | 多档位时默认显示；未设多档位时默认**不显示** |
| `blurStyle` | `BlurStyle` | 无模糊背景 | 半模态面板的模糊背景 |
| `maskColor` | `ResourceColor` | `$r('sys.color.ohos_id_color_mask_thin')` | **`enableOutsideInteractive: true` 时本属性无效** |
| `enableOutsideInteractive` | `boolean` | 底部/居中不可交互，跟手可交互 | `true` 时不显示蒙层 |
| `backgroundColor` | `ResourceColor` | `Color.White` | **设 `systemMaterial` 时可能被覆盖，不建议同用** |
| `borderWidth` / `borderColor` | — | 0vp / Black | **设 `systemMaterial` 时可能被覆盖，不建议同用**；底部弹窗下底部边框无效 |
| `shadow` | `ShadowOptions \| ShadowStyle` | 非 2in1 无阴影 | **设 `systemMaterial` 时可能被覆盖，不建议同用**；`CONTENT_COVER` 不支持 |
| `systemMaterial` | `SystemUiMaterial` | `undefined` | **起始版本 26.0.0** |
| `onWillAppear` 12+ | `() => void` | — | 显示动画**开始前**（做准备工作） |
| `onAppear` | `() => void` | — | 显示动画**结束后**（做 UI 更新） |
| `onWillDisappear` 12+ | `() => void` | — | 回退动画开始前（做状态保存）。**不允许在内部修改状态变量** |
| `onDisappear` | `() => void` | — | 回退动画结束后（做资源释放） |

### 2.3 SheetSize / SheetType 枚举

【官方规范】同上文档。

**`SheetSize`**：

| 名称 | 值 | 说明 |
|---|---|---|
| `MEDIUM` | 0 | 窗口高度的 **60%**（TV 50%）。**居中/跟手弹窗下无效，显示 560vp** |
| `LARGE` | 1 | 几乎为窗口高度。**居中/跟手弹窗下无效，显示 560vp** |
| `FIT_CONTENT` 11+ | 2 | 高度适应内容。**builder 根节点高度不能用百分比**，两者不能互相依赖布局 |

**`SheetType`**：

| 名称 | 值 | 说明 |
|---|---|---|
| `BOTTOM` | 0 | 底部弹窗 |
| `CENTER` | 1 | 居中弹窗 |
| `POPUP` | 2 | 跟手弹窗（不支持跟手滑动，下滑不关闭） |
| `SIDE` 20+ | 3 | 侧边弹窗（宽度 >600vp 才可设） |
| `CONTENT_COVER` 20+ | 4 | 全屏弹窗。**不支持 showClose / shadow / maskColor / dragBar** |

### 2.4 设计规范：档位与形态

【官方规范】出处：`references/huawei-docs/design-guides/bindsheet-0000001956852753.md`

底部面板的多档位高度：

| 档位 | 规则 |
|---|---|
| `Large` | 屏幕/窗口高度 − 信号栏 − **8** |
| `Medium` | **60%** 屏幕/窗口高度 |
| `Free` | 完全自定义展示高度 |

手机（直板机）尺寸规格：`Size-Regular` 最大高度距信号栏 **8vp**；
`Size-Medium` = 屏幕高度 **60%**；`Size-Free` 自定义/内容自适应。
手机**横屏**宽度最大 **480vp**，高度距屏幕顶部 **8vp**。

平板（>600vp 断点）：变更为**窗口模式**居中，默认 **560 × 480**，
最小高度 **320vp**，最大高度屏幕短边 **90%**。
电脑：最大高度始终为窗口高度 **90%**。

沉浸光感相关原文（同文档「### 沉浸光感」）：

> 使用半模态沉浸光感样式时，**如半模态内存在复杂的卡片容器，建议卡片容器使用
> 不透明度低于 60% 的背景色**，在保障可读性的同时，增强页面沉浸感受。

> 使用半模态面板时，如半模态内存在标题栏，建议同时使用沉浸光感样式……
> **关闭按钮同时需要使用沉浸光感效果。**

> ⚠️ **同文档也明确：多个半模态重叠时"第一层级无法覆盖第二层级"**，建议默认用
> 最大比例弹出框，或统一不同层级的面板高度。项目用「独立宿主节点」规避（见 3.2）。

### 2.5 沉浸光感与 systemMaterial

【官方规范】`ts-universal-attributes-sheet-transition.md:133`：

> `systemMaterial`：设置组件的系统材质。**起始版本：26.0.0**。
> 不同系统材质对应不同的属性影响效果，该接口影响背景色 `backgroundColor`、
> 边框颜色 `borderColor`、边框宽度 `borderWidth`、阴影 `shadow`，
> **不建议与上述接口一起使用**。

官方示例 10（同文档，`…:1040-1059`）的写法：

```ts
.bindSheet($$this.isShow, this.myBuilder(), {
  height: this.sheetHeight,
  // 以下接口不建议与 systemMaterial 一起使用
  // borderWidth: 20,
  // borderColor: Color.Red,
  // backgroundColor: Color.Green,
  // shadow: { radius: 30, type: ShadowType.COLOR, color: Color.Yellow },
  // 某些材质效果不自带背景，会被 backgroundColor 设置的颜色覆盖，
  // 若要呈现此类材质效果，建议将背景色改为透明色
  backgroundColor: Color.Transparent,
  systemMaterial: this.myMaterial // 从 API 版本 26.0.0 开始，新增 systemMaterial 属性
})
```

> 这两条注释就是项目「显式写 `backgroundColor(AppMaterial.SheetBackground)`」
> 与「内容根节点不写背景」两个做法的官方依据（见 3.5）。

---

## 3. 项目实践

工程根：`C:\Users\icehomura\workspace\arkts\HarmonyOS-book`（下称 `<ROOT>`）。

### 3.1 十个抽屉的全量参数表

【项目实践】实测命令：

```bash
cd <ROOT>
grep -rno "\.bindSheet(" entry/src/main/ets --include=*.ets | wc -l   # → 10
grep -rn "bindContentCover" entry/src/main/ets --include=*.ets | wc -l # → 0
grep -rn "hoverEffect"      entry/src/main/ets --include=*.ets | wc -l # → 0
```

| # | 宿主文件:行 | 状态变量 | `height` | `preferType` | `showClose` | `dragBar` | `maskColor` | `systemMaterial` |
|---|---|---|---|---|---|---|---|---|
| 1 | `components/AppearanceSettingsComponent.ets:190` | `showMaterial` | `FIT_CONTENT` | `BOTTOM` | 默认 `true` | 默认 | 默认 | `AppMaterial.Sheet` |
| 2 | `components/AppearanceSettingsComponent.ets:213` | `showAccent` | `FIT_CONTENT` | `BOTTOM` | 默认 `true` | 默认 | 默认 | `AppMaterial.Sheet` |
| 3 | `pages/PlayerPage.ets:1208` | `showChapterList` | `'55%'` | `BOTTOM` | `false` | `true` | 默认 | `AppMaterial.PlayerSheet` |
| 4 | `pages/PlayerPage.ets:1245` | `showSpeedSheet` | `SheetSize.FIT_CONTENT` | `BOTTOM` | `false` | `true` | 默认 | `AppMaterial.PlayerSheet` |
| 5 | `pages/PlayerPage.ets:1277` | `showSleepSheet` | `SheetSize.FIT_CONTENT` | `BOTTOM` | `false` | `true` | 默认 | `AppMaterial.PlayerSheet` |
| 6 | `pages/PlayerPage.ets:1315` | `showSkipSheet` | `SheetSize.FIT_CONTENT` | `BOTTOM` | `false` | `true` | 默认 | `AppMaterial.PlayerSheet` |
| 7 | `pages/ReaderPage.ets:1330` | `showSpeechSheet` | `'82%'` | `BOTTOM` | `false` | 默认 | `Color.Transparent` | `AppMaterial.ReaderSheetThick` |
| 8 | `pages/ReaderPage.ets:1388` | `showSettingsSheet` | `'82%'` | `BOTTOM` | `false` | 默认 | `Color.Transparent` | `AppMaterial.ReaderSheetThick` |
| 9 | `pages/ReaderPage.ets:1414` | `showChapterSheet` | `'58%'` | `BOTTOM` | `false` | 默认 | `Color.Transparent` | `AppMaterial.ReaderSheetThick` |
| 10 | `pages/RuleSourcePage.ets:1301` | `showTalebook` | `SheetSize.LARGE` | 默认 | `true` | 默认 | 默认 | 未设（走系统默认） |

**可归纳的约定**：

- **`preferType` 一律 `SheetType.BOTTOM`**（手机形态；宽屏由系统自动升为居中/跟手）。
- **阅读/播放的 7 个功能抽屉一律 `showClose: false`**，全部自绘关闭按钮（见 3.4）。
  只有「外观选择」和「Talebook 连接」保留系统关闭图标（`showClose` 默认 true）。
- **高度两派**：内容型（`FIT_CONTENT`）用于档位/开关等固定高度面板；
  **百分比高度**用于需要滚动的长列表（章节 55%/58%、阅读设置 82%）。
- **`dragBar: true` 只在播放页显式写**。阅读页不写——因为三处都没设 `detents`，
  按官方默认本来就**不显示**控制条（`ts-universal-attributes-sheet-transition.md:101`）。
- **`maskColor: Color.Transparent` 只在阅读页写**：阅读场景不希望蒙层压暗正文。
  注意官方说明「`enableOutsideInteractive: true` 时 `maskColor` 无效」，
  项目**没有**设 `enableOutsideInteractive`，因此下层仍不可交互，只是不显示蒙层。

### 3.2 铁律：不同弹层必须挂不同宿主节点

【项目实践】源码注释（`pages/ReaderPage.ets:1329`）：

```ts
ReaderBackground({ /* ... */ })
  // 每个弹层使用独立宿主；同一节点连续 bindSheet 会覆盖前一个绑定。
  .bindSheet($$this.showSpeechSheet, this.buildSpeechSheet(), { /* ... */ })
```

实际做法是把 3 个抽屉挂到**三个不同层级**的节点上：

| 抽屉 | 宿主节点 | 位置 |
|---|---|---|
| 朗读面板 | `ReaderBackground`（最底层背景） | `ReaderPage.ets:1323-1340` |
| 阅读设置 | 包住正文 + 底部栏的中间层 `Stack` | `ReaderPage.ets:1343-1403` |
| 章节目录 | 页面根 `Stack` | `ReaderPage.ets:1412-1427` |

播放页同理，4 个抽屉分别挂在 4 个不同的 `Column`/`Stack` 上
（`PlayerPage.ets:1200-1218`、`1229-1254`、`1262-1286`、`1296-1324`）。

> ⚠️ 「同一节点连续 `bindSheet` 会覆盖」这句话在本地官方文档库中
> **未检索到明确表述**（`search-docs.mjs "bindSheet"` 的 15 篇命中里没有该结论）。
> 它属于**工程实测结论**，请按项目实践对待；官方文档只说明了
> 「半模态是一个严格和宿主节点绑定在一起的弹窗」以及重叠时层级问题。

### 3.3 材质选型：阅读类 vs 播放类

【项目实践】`theme/Theme.ets`：

```ts
// Theme.ets:109-115
static get Sheet(): uiMaterial.Material | undefined {
  if (!PlatformCompat.immersiveMaterial) return undefined;
  return AppMaterial.material('sheet', uiMaterial.ImmersiveStyle.THIN, true, false);
}
static get PlayerSheet(): uiMaterial.Material | undefined {
  return AppMaterial.Sheet;
}

// Theme.ets:121-125 —— 阅读弹层固定厚度，避免正文透出干扰设置项，不跟随外观厚度选项。
static get ReaderSheetThick(): uiMaterial.Material | undefined {
  if (!PlatformCompat.immersiveMaterial) return undefined;
  return AppMaterial.material('readerSheetThick', uiMaterial.ImmersiveStyle.THICK,
    true, false, false, /* fixedStyle */ true);
}
```

| | 阅读类（朗读/设置/目录） | 播放类（章节/速度/定时/跳过） |
|---|---|---|
| 令牌 | `AppMaterial.ReaderSheetThick` | `AppMaterial.PlayerSheet` |
| 档位 | `THICK` **固定**（`fixedStyle = true`） | `THIN`，**跟随**外观设置（`AppMaterial.resolveStyle`） |
| 原因 | 正文在抽屉下方，薄材质会让文字透出、干扰设置项阅读 | 播放页背景是纯色渐变封面，薄材质即可 |
| 降级 | `AppMaterial.ReaderSheetBlur` = `BlurStyle.COMPONENT_THICK` | `AppMaterial.SheetBlur` = 按外观档位映射的 `BlurStyle` |

两个配套 getter（`theme/Theme.ets:138-144`）：

```ts
static get SheetBackground(): ResourceColor {
  return PlatformCompat.immersiveMaterial ? Color.Transparent : $r('sys.color.comp_background_primary');
}
static get SheetBlur(): BlurStyle | undefined {
  return PlatformCompat.immersiveMaterial ? undefined : AppMaterial.fallbackBlur;
}
```

即：**支持沉浸材质时 `backgroundColor` 传 `Color.Transparent`（对齐官方示例 10 的建议），
不支持时回落到系统一级背景色 + 磨砂**。注意 `backgroundColor` 与 `blurStyle`
**都是必写字段**——它们只是在不同 API 段生效。

### 3.4 showClose: false → 必须自绘关闭按钮

【项目实践】三种自绘关闭按钮写法，按场景选：

**(a) 有标题行的抽屉 —— 标题右侧裸图标**（`pages/PlayerPage.ets:1720-1732`）：

```ts
Row() {
  Text('播放速度')
    .fontSize(AppFont.Title)              // 18
    .fontColor($r('sys.color.font_primary'))
    .fontWeight(FontWeight.Bold)
  Blank()
  SymbolGlyph($r('sys.symbol.xmark'))
    .fontSize(20)
    .fontColor([$r('sys.color.font_secondary')])
    .onClick(() => { this.showSpeedSheet = false; })
}
.width('100%')
.padding({ left: AppSpace.Lg, right: AppSpace.Lg, top: AppSpace.Md })
```

**(b) 需要无障碍热区 —— 圆形 Button 透明底**（`pages/PlayerPage.ets:1497-1506`）：

```ts
Button({ type: ButtonType.Circle }) {
  SymbolGlyph($r('sys.symbol.xmark'))
    .fontSize(20)
    .fontColor([$r('sys.color.font_secondary')])
}
.width(40)
.height(40)
.backgroundColor(Color.Transparent)                        // 去掉 Button 默认灰底
.accessibilityText($r('app.string.player_sleep_close'))
.onClick(() => { this.showSleepSheet = false; })
```

**(c) 设置类抽屉 —— 36vp 圆形 Stack**（`components/ReaderSettingsSheet.ets:549-558`）：

```ts
Stack({ alignContent: Alignment.Center }) {
  SymbolGlyph($r('sys.symbol.xmark'))
    .fontSize(18)
    .fontColor([$r('sys.color.font_secondary')])
}
.width(36)
.height(36)
.borderRadius(18)
.margin({ left: AppSpace.Xs })
.onClick(() => this.onClose())
```

> ⚠️ (c) 的 **36×36vp 低于官方 UX 标准 2.1.3.3 的 40×40vp 下限**
> （`design-guides/ux-guidelines-general-0000001760708152.md:110`）。
> 它是"视觉尺寸 36 + 相邻"的妥协，**不是可推荐的做法**；
> 新写代码请用 (b) 的 40×40 或直接补 `responseRegion` 把热区做到 48×48。

### 3.5 内容根节点不写任何背景属性

【项目实践】`components/ReaderSettingsSheet.ets:586-587` 是整个抽屉 builder 的**收尾**：

```ts
    .width('100%')
    .height('100%')
  }   // ← Column 到此结束，没有 .backgroundColor() / .backgroundBlurStyle()
```

对比 `components/GlassSurface.ets:47-81` 的 `GlassSheetSurface`——它是**独立浮层组件**
（不是 `bindSheet` 内容），所以它**必须自己铺材质**：

```ts
Stack({ alignContent: Alignment.Bottom }) {
  Column().width(LayoutPolicy.matchParent).height(LayoutPolicy.matchParent)
    .attributeModifier(AppMaterial.modifier(AppMaterial.DialogUltraThick))
    .hitTestBehavior(HitTestMode.None)
  Column().width(LayoutPolicy.matchParent).height(LayoutPolicy.matchParent)
    .backgroundColor(AppColor.GlassSheetFallback)                  // 降级兜底
    .hitTestBehavior(HitTestMode.None)
  this.content()
}
.borderRadius({ topLeft: this.cornerRadius, topRight: this.cornerRadius })
.clip(true)
.border({ width: 0.5, color: AppColor.GlassSheetStroke })
```

**判别规则**：材质由**谁**提供？

- 由 `bindSheet` 的 `systemMaterial` 提供 → 内容根节点**不写背景**（透出材质）。
- 由组件自己提供 → 用 `GlassSheetSurface`，材质层 + 兜底色层都设
  `hitTestBehavior(HitTestMode.None)`，**不吃事件**。

### 3.6 控件底用半透明 tint，不用实色

【项目实践】抽屉内控件底色统一走两个令牌（`theme/Theme.ets:39-41`）：

| 令牌 | 资源 | 浅色值 | 深色值 | 用途 |
|---|---|---|---|---|
| `AppColor.GlassSheetControlTint` | `app.color.glass_sheet_control_tint` | `#1FFFFFFF` | `#1FFFFFFF` | **抽屉内**控件底（白 12%） |
| `AppColor.GlassSheetStroke` | `app.color.glass_sheet_stroke` | `#3DFFFFFF` | `#3DFFFFFF` | 抽屉内 0.5vp 描边（白 24%） |
| `AppColor.GlassControlTint` | `app.color.glass_control_tint` | `#F2FFFFFF` | `#E62C2C2C` | 抽屉外控件底 |
| `AppColor.GlassStroke` | `app.color.glass_stroke` | `#1A000000` | — | 抽屉外描边 |

来源：`entry/src/main/resources/base/element/color.json:34-43`、
`entry/src/main/resources/dark/element/color.json:34-38`。

分组卡片的标准写法（`components/ReaderSettingsSheet.ets:58-73`）：

```ts
Column({ space: AppSpace.Sm }) {          // 12
  Text(this.title)
    .fontSize(AppFont.Caption)            // 12
    .fontColor($r('sys.color.font_secondary'))
    .fontWeight(FontWeight.Medium)
    .width('100%')
  this.content()
}
.width('100%')
.alignItems(HorizontalAlign.Start)
.padding(AppSpace.Md)                     // 16
.borderRadius(AppRadius.Lg)               // 16
.backgroundColor(AppColor.GlassSheetControlTint)   // 白 12%，不是实色
.border({ width: 0.5, color: AppColor.GlassSheetStroke })
```

分档 chip（`ReaderSettingsSheet.ets:83-95`）：未选中用 `GlassSheetControlTint`，
选中用 `AppColor.Brand` 底 + `AppColor.OnBrand` 字，`borderRadius(AppRadius.Pill)`，
`animation({ duration: AppMotion.Fast, curve: AppCurve.Standard })`（150ms）。

> 官方对应依据：`design-guides/bindsheet…md`「沉浸光感」节
> 「**建议卡片容器使用不透明度低于 60% 的背景色**」。项目用 12% 白，
> 比官方上限更克制——**符合规范，且更保守**。

### 3.7 文字型按钮显式去掉默认灰底

【项目实践】`pages/PlayerPage.ets:1459-1471`：

```ts
@Builder
buildSleepModeTab(mode: SleepMode) {
  Button(mode === SleepMode.Duration ? $r('app.string.player_sleep_by_time')
                                     : $r('app.string.player_sleep_by_chapter'))
    .type(ButtonType.Normal)
    .layoutWeight(1)
    .height(40)
    .fontSize(AppFont.Body)                                     // 14
    .fontWeight(this.sleepSheetMode === mode ? FontWeight.Medium : FontWeight.Normal)
    .fontColor(this.sleepSheetMode === mode ? AppColor.Brand : $r('sys.color.font_secondary'))
    .backgroundColor(this.sleepSheetMode === mode
      ? AppColor.BrandSoft : Color.Transparent)                 // ← 未选中必须显式透明
    .borderRadius(AppRadius.Sm)
    .onClick(() => this.selectSleepMode(mode))
}
```

**为什么必须写 `Color.Transparent`**：`Button` 组件默认带一层灰底，
不显式覆盖就会在半透明材质上出现一块突兀的实色。

**判别规则**（与 3.5「判别规则」配套）：

| 元素类型 | 背景写法 |
|---|---|
| 容器 / 卡片 | `AppColor.GlassSheetControlTint`（白 12%） |
| 文字型 `Button` | `Color.Transparent` 或 `AppColor.BrandSoft`（选中态） |
| 图标型圆形按钮 | `Color.Transparent` + 材质（见 [circle-button.md](circle-button.md)） |
| 抽屉内容根节点 | **不写**（透出 `systemMaterial`） |

对照 `AppearanceSettingsComponent` 的选中态也走 `AppColor.BrandSoft`
（= `'#22' + accent`，13% 品牌色，`theme/Theme.ets:23-26`）。

### 3.8 生命周期：onAppear / onDisappear / onWillDismiss

【项目实践】三个真实用法：

**(a) 打开时滚动到当前位置**（`pages/ReaderPage.ets:1422`、
`pages/PlayerPage.ets:1216`）：

```ts
onAppear: (): void => this.scrollChapterListToCurrent(),
// PlayerPage 另一处写法：
onAppear: () => this.scrollToCurrentChapter(),
```

**(b) 关闭时复位状态 + 恢复被隐藏的底部栏**（`pages/ReaderPage.ets:1396-1402`）：

```ts
onDisappear: (): void => {
  this.showSettingsSheet = false;
  if (!this.leaving) {
    this.saveReadingSettings();
    if (!this.showChapterSheet) this.showReaderBar();   // 两个抽屉互斥，避免误恢复
  }
}
```

朗读面板同理，但只恢复底部栏（`ReaderPage.ets:1336-1339`）。

**(c) 中断退出**（`pages/RuleSourcePage.ets:1304-1306`）：

```ts
onWillDismiss: (action: DismissSheetAction): void => {
  if (!this.isImporting) action.dismiss();   // 导入中不允许关闭
}
```

> 官方对应：`ts-universal-attributes-sheet-transition.md:160-172`（`### BindOptions` 表，
> `onWillDisappear` 在 `:171`）——
> "**不允许在 `onWillDisappear` 函数中修改状态变量，可能会导致组件行为不稳定**"。
> 项目所有状态复位都放在 **`onDisappear`**（动画结束后），符合官方建议。

### 3.9 返回键拦截

【项目实践】`pages/PlayerPage.ets:279-295`（`handleBack`）：

```ts
/**
 * 返回拦截:任一抽屉打开时先关抽屉并消费返回事件,否则放行让 NavDestination 正常退页。
 * 实际同时只会有一个抽屉打开,逐个判断即可。
 */
private handleBack(): boolean {
  if (this.showChapterList) { this.showChapterList = false; return true; }
  // ... 其余抽屉同理
}
```

**要点**：抽屉打开时**先关抽屉并消费事件**，不要直接退页。
配合 3.2 的「同一时刻只有一个抽屉」前提，"逐个判断"即可。

### 3.10 抽屉内容骨架模板

【项目实践】把 `components/ReaderSettingsSheet.ets` 的 `build()` 抽象成通用骨架
（`ReaderSettingsSheet.ets:534-588`）：

```ts
build() {
  Column() {
    // ① 标题行：标题 + 可选的"恢复默认"胶囊 + 关闭按钮
    Row() {
      Text('阅读设置')
        .fontSize(AppFont.Title)                 // 18
        .fontColor($r('sys.color.font_primary'))
        .fontWeight(FontWeight.Bold)
      Blank()
      Text('恢复默认')
        .fontSize(AppFont.Caption)               // 12
        .fontColor($r('sys.color.font_secondary'))
        .padding({ left: AppSpace.Sm, right: AppSpace.Sm, top: 6, bottom: 6 })
        .borderRadius(AppRadius.Pill)
        .backgroundColor(AppColor.GlassSheetControlTint)
        .onClick(() => this.onResetDefaults())
      Stack({ alignContent: Alignment.Center }) { /* xmark 36×36 圆 */ }
        .margin({ left: AppSpace.Xs })
        .onClick(() => this.onClose())
    }
    .width('100%')
    .alignItems(VerticalAlign.Center)
    .padding({ left: AppSpace.Lg, right: AppSpace.Md, bottom: AppSpace.Sm })

    // ② 可滚动内容区
    Scroll() {
      Column({ space: AppSpace.Md }) {           // 卡片间距 16
        this.buildPreview()                      // 实时预览（可选）
        this.buildFontSizeSection()
        this.buildLineHeightSection()
        this.buildPageTurnModeSection()
        this.buildThemeSection()
        this.buildMarginSection()
        this.buildReadingStatusSection()
      }
      .width('100%')
      .padding({ left: AppSpace.Lg, right: AppSpace.Lg, bottom: AppSpace.Lg })
    }
    .width('100%')
    .layoutWeight(1)                             // ← 撑满剩余高度
    .scrollBar(BarState.Off)                     // 抽屉内不要滚动条
    .edgeEffect(EdgeEffect.Spring)
  }
  .width('100%')
  .height('100%')
  // ← 到此结束。不写 backgroundColor / backgroundBlurStyle（见 3.5）
}
```

**关键设计点**：

1. **`showClose: false` 靠 ① 的关闭按钮兜底**，且标题行不放"返回"，因为抽屉是平的。
2. **`layoutWeight(1)` + `scrollBar(BarState.Off)`**：抽屉高度由 `bindSheet`
   的 `height` 决定，内容区自适应剩余高度且不显示滚动条。
3. **预览区用 `Stack` 叠真实 `ReaderBackground`**，做到"所见即所得"
   （`ReaderSettingsSheet.ets:189-232`，高 160vp，`borderRadius(AppRadius.Lg)` + `clip(true)`）。
4. **分组卡片必须是独立 `@ComponentV2 struct`**，不能是父组件的 `@Builder` 方法——
   因为 UI 描述（尾随闭包 `{ }`）不能当普通 lambda 参数传
   （`ReaderSettingsSheet.ets:44-48` 有明确注释）。

---

## 4. 未证实清单

| # | 条目 | 状态 |
|---|---|---|
| 1 | 「同一宿主节点连续 `bindSheet` 会覆盖前一个绑定」 | ⚠️ **未证实**（项目源码注释结论，本地官方文档库无对应表述）。工程实测有效，但不要称之为官方规范 |
| 2 | 半模态**拖拽条尺寸、内容内边距**具体数值 | ⚠️ **未证实**（官方配图中；`design-specs.md` §11 已列） |
| 3 | 抽屉**圆角**独立数值 | ⚠️ **未证实**（官方无"抽屉"独立圆角，归入半模态 = 32vp；`Theme.ets` 未对 `bindSheet` 设圆角） |
| 4 | 抽屉内"恢复默认"胶囊的**具体内边距 / 圆角** | ⚠️ **未证实**（`6 / AppRadius.Pill` 来自项目代码，非官方数值） |
| 5 | **`maskColor: Color.Transparent` 但不设 `enableOutsideInteractive`** 时下层是否真的不可交互 | ⚠️ **未证实**（官方只说 `enableOutsideInteractive: true` 时 `maskColor` 无效，未描述反向组合；项目按"不可交互"假定） |
| 6 | 阅读抽屉 `82%` / 章节 `58%` / `55%` 这三个百分比 | ⚠️ **未证实**（项目自定，非官方档位；官方档位是 Large / Medium(60%) / Free） |

---

## 5. 相关分技能

- [组件参考总目录](README.md) —— 证据分级约定、材质选型速查、跨组件强制约定
- [圆形按钮与更多菜单](circle-button.md) —— 抽屉内外的圆形按钮 / 关闭按钮统一写法
- [列表 / 网格 / 骨架屏 / 下拉刷新](lists.md) —— 抽屉内的章节 `List`、书架三列布局
- [沉浸光感材质](../immersive-material/README.md) —— `uiMaterial` / `hdsMaterial` 两套 API、生效范围铁律
- [官方设计规范数值表](../design-specs.md) —— §7 半模态与对话框的官方档位与尺寸

**官方 API 原文**：

- `references/huawei-docs/harmonyos-references/ts-universal-attributes-sheet-transition.md`
- `references/huawei-docs/harmonyos-references/errorcode-bindsheet.md`（半模态错误码）
- `references/huawei-docs/design-guides/bindsheet-0000001956852753.md`
- <https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-universal-attributes-sheet-transition#bindsheet>
