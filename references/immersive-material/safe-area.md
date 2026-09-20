# 安全区与刘海避让（Safe Area / AvoidArea）

> **用途**：沉浸式全屏布局下，状态栏、导航条、三档导航、挖孔区都会压到应用内容上。
> 本文给出「取避让区域高度 → 避让系统栏 → 监听过期刷新」这条链路的**确切 API、调用时机与坑位**，
> 以及标题栏避让的两种落地模式与官方设计数值。
>
> **证据约定**：
> - `entry/src/main/ets/...:行号` —— 指向真实工程
>   `C:\Users\icehomura\workspace\arkts\HarmonyOS-book`，行号为撰写时实测值。
> - `references/huawei-docs/...` —— 指向本技能包内的官方文档本地副本（剪藏）。
> - 官方 URL 直接给出链接。**官方未表述而仅来自项目实践的结论，会显式标注「未证实」。**

## 目录

- [1. 速查表](#1-速查表)
- [2. 取避让高度：getWindowAvoidArea](#2-取避让高度getwindowavoidarea)
- [3. 四种 AvoidAreaType 的用途](#3-四种-avoidareatype-的用途)
- [4. 沉浸式全屏与透明系统栏](#4-沉浸式全屏与透明系统栏)
- [5. px → vp 换算与 density 来源](#5-px--vp-换算与-density-来源)
- [6. 调用时机](#6-调用时机)
- [7. 三级监听与防抖](#7-三级监听与防抖)
- [8. 标题栏避让的两种模式](#8-标题栏避让的两种模式)
- [9. 页面统一的 expandSafeArea 用法](#9-页面统一的-expandsafearea-用法)
- [10. 底部避让：系统导航条抬高 28vp](#10-底部避让系统导航条抬高-28vp)
- [11. 阅读页：隐藏状态栏与控制字色](#11-阅读页隐藏状态栏与控制字色)
- [12. 官方挖孔区适配规则（UX 标准 2.1.2.2）](#12-官方挖孔区适配规则ux-标准-2122)
- [13. 反模式](#13-反模式)
- [14. 官方出处速查](#14-官方出处速查)
- [15. 相关分技能](#15-相关分技能)

---

## 1. 速查表

| 需求 | API / 属性 | 起点 | 出处 |
|---|---|---|---|
| 取状态栏/刘海高度 | `win.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM).topRect.height` | API 9 | `arkts-apis-window-window.md:1590` |
| 取底部导航条高度 | 同上，`TYPE_NAVIGATION_INDICATOR` → `bottomRect.height` | API 11 | `arkts-apis-window-e.md:93` |
| 取三档导航高度 | 同上，`TYPE_FLOAT_NAVIGATION` → `bottomRect.height`，**须先使能** | API 26 | `arkts-apis-window-e.md:94` |
| 取挖孔区 | 同上，`TYPE_CUTOUT` | API 9 | `arkts-apis-window-e.md:90` |
| 使能三档导航避让 | `win.setFloatNavigationAvoidAreaEnabled(true)` | API 26 | `arkts-apis-window-window.md:2089` |
| 进入沉浸式布局 | `win.setWindowLayoutFullScreen(true)` | API 9 | `arkts-apis-window-window.md:1924` |
| 系统栏透明 | `win.setWindowSystemBarProperties({ statusBarColor: '#00000000', navigationBarColor: '#00000000' })` | API 9 | `arkts-apis-window-window.md:2481` |
| 系统栏字色 | 同上，`statusBarContentColor` / `navigationBarContentColor` | API 8 | `arkts-apis-window-i.md:94,97` |
| 隐藏/显示单条系统栏 | `win.setSpecificSystemBarEnabled('status', false)` | API 11 | `arkts-apis-window-window.md:2403` |
| px→vp 系数 | `win.getWindowDensityInfo()` | API 15 | `arkts-apis-window-window.md:1369` |
| 组件延伸绘制到安全区 | `.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])` | API 10 | `ts-universal-attributes-expand-safe-area.md:56` |
| HDS 标题栏自动避让 | `titleBar({ avoidLayoutSafeArea: true })` | **6.0.0(20)** | `ui-design-hdsnavigation.md:1306` |
| 底部导航条抬高 | **28vp** | — | `design-guides/navigation-0000001957075737.md:63` |

---

## 2. 取避让高度：getWindowAvoidArea

**签名**（官方原文）：

```
getWindowAvoidArea(type: AvoidAreaType): AvoidArea
```

> 获取当前窗口避让区域。
> …该接口一般适用于两种场景：
> - 在 `onWindowStageCreate()` 方法中，获取应用启动时的初始布局避让区域时可调用该接口。
> - 当应用内子窗需要临时显示，对显示内容做布局避让时可调用该接口。
>
> —— `references/huawei-docs/harmonyos-references/arkts-apis-window-window.md:1590`
> （官方 URL：https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-window-window#getwindowavoidarea9）

**返回结构**（官方原文，`immersive-window-feature.md:124-142`）：

```ts
interface AvoidArea {
  visible: boolean;
  leftRect: Rect;
  topRect: Rect;
  rightRect: Rect;
  bottomRect: Rect;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}
```

> 其中包含四组 Rect 信息，表示此类型的避让区域在相对于窗口中心点的方向和具体矩形区域位置。
> **visible 属性不代表任何系统 UI 的可见性，没有实际含义，请避免使用此属性。**

⚠️ 三件事必须记住：

1. **`topRect.height` / `bottomRect.height` 的单位是 px，不是 vp。** 官方示例在用于 `padding` 前
   显式做了 `this.getUIContext().px2vp(...)`（`immersive-window-feature.md:335`）。
2. **不要读 `visible`**（官方明确要求避免使用）。
3. **避让区域可能为 0。** 官方原文：
   > 避让区域存在大小为 0 的情况，当获取到的避让区域为 0 时，开发者需注意针对性适配此时的页面区域和布局，
   > 避免贴边、内容裁剪等问题 —— `immersive-window-feature.md:312`

工程实现（`entry/src/main/ets/utils/WindowUtils.ets`）：

```ts
private static readAvoidArea(win: window.Window, type: window.AvoidAreaType): window.AvoidArea | null {
  try {
    return win.getWindowAvoidArea(type);
  } catch (_e) {
    return null;
  }
}
```

—— `WindowUtils.ets:257-263`。**每次都吞异常**：窗口销毁/切换期间 `getWindowAvoidArea` 会抛
`1300002`（`arkts-apis-window-window.md:1590` 错误码表），不吞会让上层定时器持续报错。

---

## 3. 四种 AvoidAreaType 的用途

官方枚举定义（`references/huawei-docs/harmonyos-references/arkts-apis-window-e.md`，官方 URL
https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkts-apis-window-e#avoidareatype7 ）：

| 枚举 | 值 | 官方描述 | 本地行号 |
|---|---|---|---|
| `TYPE_SYSTEM` | 0 | 表示系统默认区域。**通常表示状态栏区域**，悬浮窗状态下的应用主窗中表示三点控制栏区域。 | `:89` |
| `TYPE_CUTOUT` | 1 | 表示挖孔区域。 | `:90` |
| `TYPE_SYSTEM_GESTURE` | 2 | 表示侧边返回手势区域。**当前所有设备均无此类型避让区域。** | `:91` |
| `TYPE_KEYBOARD` | 3 | 表示固定态软键盘区域。 | `:92` |
| `TYPE_NAVIGATION_INDICATOR` | 4 | 表示底部导航区域。**当三键导航显示时，底部导航避让区域始终存在。** | `:93` |
| `TYPE_FLOAT_NAVIGATION` | 5 | 表示三键导航区域。**需要调用 `setFloatNavigationAvoidAreaEnabled()` 使能后**才能获取到，否则直接返回空的三键导航避让区域。**起始版本：26.0.0** | `:94` |

> 另有已废弃的 `TYPE_SYSTEM_ALERT`（值 1，API 11 起废弃，`arkts-apis-window-e.md:62`），不要使用。

### 3.1 TYPE_SYSTEM —— 状态栏 / 刘海高度

这是「状态栏 + 刘海高度」的**唯一正确来源**：

```ts
const systemArea = win.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM);
WindowUtils.topPx = systemArea.topRect.height;   // px
```

—— `WindowUtils.ets:281, 288`

工程里的完整取值函数（`WindowUtils.ets:151-153`）：

```ts
static getStatusBarHeightVp(): number {
  return WindowUtils.topPx / WindowUtils.density;
}
```

### 3.2 TYPE_NAVIGATION_INDICATOR —— 底部导航条

```ts
nextBottomPx = Math.max(nextBottomPx, navigationArea.bottomRect.height);
```

—— `WindowUtils.ets:282, 300`

### 3.3 TYPE_FLOAT_NAVIGATION（API 26）—— 三键导航

这是 API 26 新增类型，**必须先使能**：

```
setFloatNavigationAvoidAreaEnabled(enabled: boolean): Promise<void>
```

> 设置当前窗口是否支持获取三键导航类型的避让区域。**未调用此接口设置前，系统默认不支持获取三键导航类型的避让区域。**
> 调用该接口使能后才可以通过 `getWindowAvoidArea()` 获取到 `TYPE_FLOAT_NAVIGATION` 避让类型对应的避让区域
> 或通过 `on('avoidAreaChange')` 监听其变化。
> **起始版本：26.0.0**，**模型约束：此接口仅可在 Stage 模型下使用。**
>
> —— `references/huawei-docs/harmonyos-references/arkts-apis-window-window.md:2089-2101`

工程做法分两处：使能 + 读取都做了能力判断（`PlatformCompat.supports(26)`，见
`entry/src/main/ets/utils/PlatformCompat.ets:4-7`）：

```ts
// 使能（WindowUtils.ets:72-78）
try {
  if (PlatformCompat.supports(26)) {
    await win.setFloatNavigationAvoidAreaEnabled(true);
  }
} catch (_e) {
  // Keep the regular system/nav-indicator fallback on devices without float-navigation support.
}

// 读取（WindowUtils.ets:283-284）
const floatNavigationArea = PlatformCompat.supports(26)
  ? WindowUtils.readAvoidArea(win, window.AvoidAreaType.TYPE_FLOAT_NAVIGATION) : null;
```

底部高度取三者**最大值**（`WindowUtils.ets:296-307`）：

```ts
nextBottomPx = Math.max(nextBottomPx, systemArea.bottomRect.height);
nextBottomPx = Math.max(nextBottomPx, navigationArea.bottomRect.height);
nextBottomPx = Math.max(nextBottomPx, floatNavigationArea.bottomRect.height);
```

### 3.4 TYPE_CUTOUT —— 挖孔区

工程只在**一个特殊场景**用到它：阅读页进入全屏、系统栏被临时拉出时，用挖孔区高度替换
状态栏高度，避免正文被压缩（`WindowUtils.ets:289-295`）：

```ts
if (WindowUtils.readerActive && win.getWindowStatus() === window.WindowStatusType.FULL_SCREEN) {
  const cutoutArea = WindowUtils.readAvoidArea(win, window.AvoidAreaType.TYPE_CUTOUT);
  if (cutoutArea !== null) {
    // 临时拉出系统栏也不压缩正文；小窗仍使用实际系统避让区。
    WindowUtils.topPx = cutoutArea.topRect.height;
  }
}
```

⚠️ **挖孔区默认不参与 `expandSafeArea`**（见 [§9](#9-页面统一的-expandsafearea-用法)）。

---

## 4. 沉浸式全屏与透明系统栏

```
setWindowLayoutFullScreen(isLayoutFullScreen: boolean): Promise<void>
```

> 非自由窗口状态下，可通过使用 `setWindowLayoutFullScreen()` 或 `setImmersiveModeEnabledState()`
> 接口设置当前窗口进入/退出窗口沉浸式布局。
> **沉浸式布局是窗口内元素的布局方式，进入或退出沉浸式布局不会改变窗口尺寸和位置，仅会影响应用界面内元素的布局。**
>
> —— `references/huawei-docs/harmonyos-guides/immersive-window-feature.md:65-67`

工程写法（`WindowUtils.ets:67-71`）：

```ts
await win.setWindowLayoutFullScreen(true);
await win.setWindowSystemBarProperties({
  statusBarColor: '#00000000',
  navigationBarColor: '#00000000'
});
```

`SystemBarProperties` 字段官方说明（`references/huawei-docs/harmonyos-references/arkts-apis-window-i.md`）：

| 字段 | 说明 | 行号 |
|---|---|---|
| `statusBarColor` | 状态栏背景颜色。入参为十六进制 RGB 或 ARGB，不区分大小写。默认值为系统配置的颜色。 | `:92` |
| `isStatusBarLightIcon` | 状态栏图标是否为高亮状态。默认 `false`。 | `:93` |
| `statusBarContentColor` | **状态栏文字颜色。当设置此属性后，`isStatusBarLightIcon` 属性设置无效。** 默认值 `'#E5FFFFFF'`。 | `:94` |
| `navigationBarColor` | 三键导航栏背景颜色。**HarmonyOS 各设备不支持此能力。** | `:95` |
| `isNavigationBarLightIcon` | 三键导航栏图标高亮。**HarmonyOS 各设备不支持此能力。** | `:96` |
| `navigationBarContentColor` | 三键导航栏文字颜色。**HarmonyOS 各设备不支持此能力。** | `:97` |

⚠️ 两个官方明确写出的限制，别踩：

> 子窗口调用后不生效。**主窗口在非全屏/最大化模式（自由悬浮窗口模式、分屏等场景）下配置不生效**，
> 进入全屏/最大化模式后配置生效。
> —— `arkts-apis-window-window.md:2481`

> `setSpecificSystemBarEnabled()`、`setWindowSystemBarEnable()` 等控制系统界面元素显示的接口
> **仅非自由窗口状态下的主窗口支持调用**，在辅助窗口中调用或自由窗口状态下调用不生效。
> —— `immersive-window-feature.md:158`

**工程注意**：`navigationBarColor: '#00000000'` 在 HarmonyOS 设备上按上表「不支持此能力」，
属于**可写但不保证生效**；工程写法见 `WindowUtils.ets:68-71`。

---

## 5. px → vp 换算与 density 来源

避让区域返回 px，ArkTS 布局用 vp，中间必须换算。工程**不使用** `px2vp()`，
而是自己缓存 density 做除法。

### 5.1 density 取值优先级

官方 `WindowDensityInfo` 字段（`references/huawei-docs/harmonyos-references/arkts-apis-window-i.md`）：

| 字段 | 说明 | 行号 |
|---|---|---|
| `systemDensity` | 窗口所在屏幕的系统显示大小缩放系数，跟随用户设置变化，**范围 0.5–4.0**。 | `:403` |
| `customDensity` | 窗口自定义设置的显示大小缩放系数，**范围 0.5–4.0**。未设置时跟随系统。**该参数仅主窗口生效**，在子窗、模态窗、全局悬浮窗或系统窗口上等于 `systemDensity`。 | `:405` |

```
getWindowDensityInfo(): WindowDensityInfo
```
> 当返回值为 `[-1, -1, -1]` 时，表示当前设备不支持使用该接口。
> —— `arkts-apis-window-window.md:1369`

工程实现（`WindowUtils.ets:265-276`），**优先级：customDensity > systemDensity > display.densityPixels**：

```ts
private static updateDensity(win: window.Window): void {
  try {
    const densityInfo = win.getWindowDensityInfo();
    const windowDensity = densityInfo.customDensity > 0 ? densityInfo.customDensity : densityInfo.systemDensity;
    if (windowDensity > 0) {
      WindowUtils.density = windowDensity;
      return;
    }
  } catch (_e) { /* use display density */ }
  const displayDensity = display.getDefaultDisplaySync().densityPixels;
  if (displayDensity > 0) WindowUtils.density = displayDensity;
}
```

字段名是 `customDensity` / `systemDensity` / `density`（`WindowDensityInfo` 三字段，官方 `i.md:401-405`）。

> ⚠️ `WindowUtils` 的静态初值是 `private static density: number = 3.25;`（`WindowUtils.ets:18`），
> 这是一个**硬编码兜底值**，在 `updateDensity()` 首次成功执行前生效。别把它当规范值。

### 5.2 换算函数

```ts
static pxToVp(valuePx: number): number {
  return valuePx / WindowUtils.density;
}

static vpToPx(valueVp: number): number {
  return valueVp * WindowUtils.density;
}
```
—— `WindowUtils.ets:167-173`

官方文档的等价写法是用 UI 上下文：`this.getUIContext().px2vp(this.topAvoidHeight)`
（`immersive-window-feature.md:335`）。两者等价，工程选自管 density 是为了
在非组件上下文（`WindowUtils` 是纯静态类）也能调用。

---

## 6. 调用时机

### 6.1 官方示例的写法：`loadContent` 回调内

官方两处示例都把全屏设置放在 `loadContent` 的**回调里**：

```ts
onWindowStageCreate(windowStage: window.WindowStage): void {
  windowStage.loadContent('pages/Index', async (err) => {
    if (err.code) { return; }
    try {
      const mainWindow: window.Window = windowStage.getMainWindowSync();
      await mainWindow.setWindowLayoutFullScreen(true);
      await mainWindow.setSpecificSystemBarEnabled('status', false);
    } catch (e) {
      console.error(`Failed to set status bar to invisible`);
    }
  });
}
```
—— `references/huawei-docs/harmonyos-guides/immersive-window-feature.md:175-189`
（另一处同构示例：`arkts-develop-apply-immersive-effects.md:302` 附近）

### 6.2 工程做法：`loadContent` **之前** `await`

工程把沉浸式设置整个前置到 `loadContent` 之前，**并 `await` 完成**：

```ts
private async loadMainWindow(windowStage: window.WindowStage): Promise<void> {
  try {
    await WindowUtils.setupImmersive(windowStage, this.context.config.colorMode);
  } catch (err) {
    hilog.error(DOMAIN, TAG, 'Immersive setup failed: %{public}s', JSON.stringify(err));
  }

  windowStage.loadContent('pages/Index', (err) => {
    if (err.code) {
      hilog.error(DOMAIN, TAG, 'Failed to load the content. Cause: %{public}s', JSON.stringify(err));
      return;
    }
    WindowUtils.refreshAvoidArea();   // 首帧后再刷一次，兜住设置生效延迟
  });
}
```
—— `entry/src/main/ets/entryability/EntryAbility.ets:462-476`
（调用点：`onWindowStageCreate` `:450-454`、`onWindowStageRestore` `:456-460`）

而 `setupImmersive` 内部串行 `await` 了 `setWindowLayoutFullScreen` 与
`setWindowSystemBarProperties`（`WindowUtils.ets:67-71`），所以 `loadContent` 时
窗口已是沉浸式布局。

> **「必须在 `loadContent` 之前，否则首帧标题栏跳动」——「首帧跳动」这一因果结论
> 在官方文档中没有找到表述，标注为「未证实」。**
> 可证实的只有两点：(a) 工程确实把它放在 `loadContent` 之前并 `await`（上引代码）；
> (b) 官方要求取避让区域「在 `onWindowStageCreate()` 方法中…获取应用启动时的初始布局避让区域」
> （`arkts-apis-window-window.md:1590`）。两种时序官方都能跑通，工程选了更早的那种。

### 6.3 其它必须刷新避让区域的时机

| 时机 | 工程位置 |
|---|---|
| 窗口阶段恢复 | `EntryAbility.ets:456-460`（`onWindowStageRestore`） |
| 回前台（系统颜色/系统栏可能在后台变化） | `EntryAbility.ets:531, 535` |
| 深浅色模式变更 | `EntryAbility.ets:479-483` → `WindowUtils.updateColorMode()` |
| 页面挂载 | `ReaderPage.ets:190`、`MainPage.ets:86` |

---

## 7. 三级监听与防抖

`setupImmersive` 注册**三个**窗口事件，全部指向同一个刷新函数（`WindowUtils.ets:80-82`）：

```ts
win.on('avoidAreaChange', WindowUtils.handleAvoidAreaChange);
win.on('windowSizeChange', WindowUtils.handleWindowSizeChange);
win.on('windowStatusDidChange', WindowUtils.handleWindowStatusDidChange);
```

三个 handler 都只是 `WindowUtils.refreshAvoidArea();`（`WindowUtils.ets:212-222`）。

### 7.1 各自的官方语义

| 事件 | 官方描述 | 本地出处 |
|---|---|---|
| `avoidAreaChange` | 开启当前应用窗口**系统避让区域变化**的监听。常见触发场景：全屏/悬浮/分屏模式切换、窗口旋转、折叠态变化、多设备流转。 | `arkts-apis-window-window.md:3692` |
| `windowSizeChange` | 窗口尺寸变化监听（API 7+）。 | `arkts-apis-window-window.md:3610` |
| `windowStatusDidChange` | 开启**窗口模式变化**的监听，当窗口 windowStatus 发生变化后进行通知（**此时窗口 Rect 属性已经完成更新**）。API 20+。 | `arkts-apis-window-window.md:5229` |

> `windowStatusDidChange` 的「Rect 已更新」这一点很关键：它保证回调里读到的
> `getWindowAvoidArea()` 是新值，不会读到旧几何。

### 7.2 防抖：32ms + 240ms 双定时

```ts
private static scheduleAvoidAreaRefresh(): void {
  WindowUtils.cancelPendingRefreshes();
  WindowUtils.layoutRefreshTimerId = setTimeout((): void => {
    WindowUtils.layoutRefreshTimerId = -1;
    const currentWindow = WindowUtils.mainWindow;
    if (currentWindow !== null) WindowUtils.syncAvoidArea(currentWindow);
  }, 32);
  WindowUtils.settledRefreshTimerId = setTimeout((): void => {
    WindowUtils.settledRefreshTimerId = -1;
    const currentWindow = WindowUtils.mainWindow;
    if (currentWindow !== null) WindowUtils.syncAvoidArea(currentWindow);
  }, 240);
}
```
—— `WindowUtils.ets:235-247`（`cancelPendingRefreshes` 在 `:224-233`）

机制：**每次事件先把两个 pending 定时器全部清掉**，再重排
「32ms 早刷」+「240ms 稳定后刷」两个。因为 `avoidAreaChange` 在系统栏动画期间会连发，
32ms 让第一帧布局尽快跟上，240ms 兜住动画结束后的最终值。

> ⚠️ **32ms / 240ms 这两个数值没有任何官方出处，是工程自定的经验值，标注为「未证实」。**
> 官方只要求「在避让区域更新时同时更新应用内布局」（`immersive-window-feature.md:198`），
> 未规定防抖参数。

### 7.3 监听注销

切换主窗口前必须先 `off` 三个监听，否则旧窗口会持续回调（`WindowUtils.ets:54-61`）：

```ts
const previousWindow = WindowUtils.mainWindow;
if (previousWindow !== null) {
  try {
    previousWindow.off('avoidAreaChange', WindowUtils.handleAvoidAreaChange);
    previousWindow.off('windowSizeChange', WindowUtils.handleWindowSizeChange);
    previousWindow.off('windowStatusDidChange', WindowUtils.handleWindowStatusDidChange);
  } catch (_e) { /* ignore */ }
}
```

### 7.4 对外暴露的监听接口

`WindowUtils` 把窗口事件转换成**字符串无关的 vp 回调**，页面订阅即可
（`WindowUtils.ets:86-96, 249-255`）：

```ts
static addSafeAreaListener(listener: (topVp: number, bottomVp: number) => void): void {
  if (WindowUtils.safeAreaListeners.indexOf(listener) < 0) {
    WindowUtils.safeAreaListeners.push(listener);
  }
  listener(WindowUtils.getStatusBarHeightVp(), WindowUtils.getBottomSafeVp());  // 立即回放一次
}
```

注意 `addSafeAreaListener` **注册时立即同步调用一次**，页面不用等第一次事件就有值。

页面侧用法（`MainPage.ets:58, 68-72, 84-86, 98`）：

```ts
@Local bottomSafeVp: number = WindowUtils.getBottomSafeVp();

private safeAreaChangeHandler: (topVp: number, bottomVp: number) => void =
  (_topVp: number, bottomVp: number): void => {
    if (Math.abs(this.bottomSafeVp - bottomVp) < 0.1) return;   // 0.1 容差去抖
    this.bottomSafeVp = bottomVp;
  };
```

---

## 8. 标题栏避让的两种模式

### 8.1 模式 A（推荐）：HDS `titleBar.avoidLayoutSafeArea: true`

官方定义（`references/huawei-docs/harmonyos-references/ui-design-hdsnavigation.md:1306`）：

| 名称 | 类型 | 可选 | 说明 |
|---|---|---|---|
| `avoidLayoutSafeArea` | boolean | 是 | 是否需要标题栏主动避让安全区。**默认值：false。** `true`：需要标题栏主动避让安全区；`false`：不需要。**起始版本：6.0.0(20)** |

工程所有 `HdsNavigation` 页面都开了这一项（7 处）：

```ts
.titleBar({
  avoidLayoutSafeArea: true,
  content: this.searchTitleBarContent,
  style: {
    originalStyle: { backgroundStyle: { backgroundColor: Color.Transparent } },
    scrollEffectStyle: { backgroundStyle: { backgroundColor: Color.Transparent } }
  }
})
```

—— `entry/src/main/ets/pages/HomePage.ets:1071-1091`（`avoidLayoutSafeArea` 在 `:1072`；
另一处 `:1145-1165`，`avoidLayoutSafeArea` 在 `:1146`）、
`ProfilePage.ets:178`（`:179`）、`SearchPage.ets:1013`、`FavoritePage.ets:932`、
`ReadingStatsPage.ets:410`、`BlockMorePage.ets:172`

好处：标题栏自己算避让高度，页面不用手工加 padding，**也不会和状态栏字色/材质打架**。
另外 `HdsNavigationTitleBarOptions` 还有 `enableComponentSafeArea`（把标题栏设为组件级安全区，
同样 6.0.0(20) 起，`ui-design-hdsnavigation.md:1307`）可选。

### 8.2 模式 B（手写页）：`padding({ top: statusBar + AppSpace.Sm })`

没有用 HDS 标题栏的页面，用 `WindowUtils.getStatusBarHeightVp() + AppSpace.Sm` 手工避让。
`AppSpace.Sm = 12`（`entry/src/main/ets/theme/Theme.ets:256`），所以顶部内边距 = 状态栏高度 + 12vp。

```ts
.padding({
  top: WindowUtils.getStatusBarHeightVp() + AppSpace.Sm,
  left: AppSpace.Md, right: AppSpace.Md, bottom: AppSpace.Md
})
```
—— `entry/src/main/ets/pages/AboutPage.ets:118-121`

同一模式在多个页面重复（取值都是 `+ AppSpace.Sm`）：

| 页面 | 行号 | 额外项 |
|---|---|---|
| `AboutPage.ets` | `:120` | — |
| `GuidePage.ets` | `:156` | — |
| `ImportPage.ets` | `:397` | — |
| `PrivacyPage.ets` | `:105` | — |
| `OpenSourcePage.ets` | `:92` | — |
| `CompliancePage.ets` | `:23` | — |
| `DownloadManagerPage.ets` | `:331` | — |
| `BlockMorePage.ets` | `:339` | `+ MINI_TITLE_BAR_HEIGHT` |
| `ProfilePage.ets` | `:166` | `+ MINI_TITLE_BAR_HEIGHT`（滚动内容，非标题栏本体） |
| `BookDetailPage.ets` | `:908` | 只加 `getStatusBarHeightVp()`，不加 `AppSpace.Sm` |

> **选型**：新页面优先模式 A。模式 B 只用于没有 HDS 标题栏的自绘顶栏，
> 且必须用 `WindowUtils.getStatusBarHeightVp()` 而不是写死数值。

---

## 9. 页面统一的 expandSafeArea 用法

官方定义（`references/huawei-docs/harmonyos-references/ts-universal-attributes-expand-safe-area.md:56-83`）：

```
expandSafeArea(types?: Array<SafeAreaType>, edges?: Array<SafeAreaEdge>): T
```

> 通过 `expandSafeArea` 属性支持组件**在不改变布局情况下扩展其绘制区域至安全区外**。
> —— `:45`

| 参数 | 官方默认值 | 出处 |
|---|---|---|
| `types` | `[SafeAreaType.SYSTEM, SafeAreaType.CUTOUT, SafeAreaType.KEYBOARD]` | `:82` |
| `edges` | `[SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END]` | `:83` |

工程统一写法 —— **页面根节点**加这一行：

```ts
.expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
```

覆盖 27 个页面 / 组件（实测 `grep`，节选）：

| 文件 | 行号 |
|---|---|
| `pages/MainPage.ets` | `:387` |
| `pages/HomePage.ets` | `:1038`（只扩 `TOP`，内层滚动头部） |
| `pages/ReaderPage.ets` | `:1429` |
| `pages/PlayerPage.ets` | `:902` |
| `pages/BookDetailPage.ets` | `:926` |
| `pages/ProfilePage.ets` | `:221` |
| `pages/SearchPage.ets` | `:998` |
| `pages/SettingsPage.ets` | `:337` |
| `pages/AboutPage.ets` | `:233` |
| `pages/GuidePage.ets` | `:183` |
| `pages/ImportPage.ets` | `:426` |
| `pages/PrivacyPage.ets` | `:87` |
| `pages/CompliancePage.ets` | `:78` |
| `pages/OpenSourcePage.ets` | `:74` |
| `pages/DownloadManagerPage.ets` | `:307` |
| `pages/FavoritePage.ets` | `:1005` |
| `pages/ReadingStatsPage.ets` | `:483` |
| `pages/RuleSourcePage.ets` | `:1300` |

### 9.1 官方列出的 expandSafeArea 约束（务必读完）

> - 设置 `expandSafeArea` 属性进行组件绘制扩展时，**建议组件尺寸不要设置固定宽高（百分比除外）**。
>   若设置固定宽高或 `'auto'`，则扩展安全区域的方向**只支持向上（TOP）和向起始方向（START）**扩展，
>   且扩展后的组件尺寸保持不变。 —— `:62`
> - 当父容器为滚动容器时，组件设置 `expandSafeArea` 属性后，**自身不会延伸**，但仍可触发其子节点中设置了 `expandSafeArea` 的延伸范围更新。 —— `:64`
> - 设置 `expandSafeArea()` 时，不传参走默认值处理；**设置 `expandSafeArea([], [])` 时相当于入参是空数组，此时属性设置无效。** —— `:65`
> - **滚动类容器内的组件不建议设置 `expandSafeArea` 属性。** 如果设置，需要按照组件嵌套关系，将当前节点到滚动类祖先容器间的所有直接节点设置 `expandSafeArea` 属性，否则属性在滚动后可能会失效。 —— `:69`
> - `expandSafeArea` 属性**仅作用于当前组件，不会向父组件或子组件传递**，因此开发者需为所有相关组件单独配置该属性。 —— `:70`
> - 同时设置 `expandSafeArea` 和 `position` 属性时，**`position` 属性会优先生效**。 —— `:71`
> - 对于 `expandSafeArea` 属性无法生效的场景（如弹窗和半模态组件），若要将组件部署在避让区，需要**手动调整组件的坐标**。 —— `:71`

### 9.2 挖孔区（CUTOUT）默认不生效

这是一条**高频坑**：

> `types` … 默认值包含 `SafeAreaType.CUTOUT`，**但未添加 Metadata 配置项时，页面不避让挖孔，CUTOUT 类型不生效。**
> —— `ts-universal-attributes-expand-safe-area.md:82`

工程显式只传 `SafeAreaType.SYSTEM`，因此**不依赖挖孔的 metadata 配置**；
`entry/src/main/module.json5:14-19` 的 `metadata` 只声明了 `client_id`，**没有挖孔相关配置项**。
横竖屏挖孔避让改用 `getWindowAvoidArea(TYPE_CUTOUT)` → `leftRect.width` / `rightRect.width`
的方式处理（见 §12）。

---

## 10. 底部避让：系统导航条抬高 28vp

**28vp 是官方设计指南数值**，两处独立出处：

> 系统基于深色、浅色等不同背景，为导航条提供智能反色的能力。应用在进行界面设计时，
> **需要确保为导航条底部提供沉浸式的背景和 28vp 高度的抬高避让。**
> —— `references/huawei-docs/design-guides/navigation-0000001957075737.md:63`
> （官方 URL：https://developer.huawei.com/consumer/cn/doc/design-guides/navigation-0000001957075737）

> **多设备屏幕边缘间隔尺寸** —— 屏幕底部边距：手机 **28vp** / 折叠屏 28vp / 平板 28vp / 智慧屏 27vp / 穿戴 20vp
> —— `references/huawei-docs/design-guides/interval-parameter-0000002562577161.md:64`
> （官方 URL：https://developer.huawei.com/consumer/cn/doc/design-guides/interval-parameter-0000002562577161）

> 2）合理设置底部导航栏高度，除去**导航条固定高度（28vp）**，
> 底部页签栏（此处仅涉及手机、折叠屏）在设计时应避免过高（超过 70vp）或过低（低于 40vp）。
> —— `references/huawei-docs/design-guides/ux-standard-overview-0000002019655177.md:212`

### 10.1 工程实现与「28 vs 24」的实际差异

工程底部安全区取值（`WindowUtils.ets:155-158`）：

```ts
static getBottomSafeVp(): number {
  const measuredVp = WindowUtils.bottomPx / WindowUtils.density;
  return Math.max(measuredVp, WindowUtils.FALLBACK_BOTTOM_SAFE_VP);
}
```

其中：

```ts
private static readonly FALLBACK_BOTTOM_SAFE_VP: number = 24;
```
—— `WindowUtils.ets:23`

⚠️ **这是实测值 ≠ 官方值的差异**：官方设计指南要求导航条抬高 **28vp**，
工程的**兜底常量写的是 24vp**。也就是说：

- 当 `getWindowAvoidArea()` 返回的真实导航条高度 ≥ 24vp 时，取真实值（通常是 28vp 量级），与官方一致；
- 当避让区域为 0（官方提示的「避让区域存在大小为 0 的情况」，`immersive-window-feature.md:312`）时，
  兜底只给 24vp，**比官方 28vp 少 4vp**。

> 「工程 24vp 兜底是否符合规范」——**未证实**。官方没有对「避让区域为 0 时的兜底值」作规定；
> 若追求与官方完全对齐，把该常量改成 28 更稳妥，但会改变现有页面布局高度，需真机回归。

### 10.2 浮动 Tab 栏的底部让位

工程额外有个组合公式（`WindowUtils.ets:204-210`）：

```ts
static getFloatingTabBottomVp(bottomSafeVp?: number): number {
  const safeBottom = bottomSafeVp !== undefined ? bottomSafeVp : WindowUtils.getBottomSafeVp();
  return safeBottom + WindowUtils.FLOATING_BOTTOM + WindowUtils.FLOATING_TAB_HEIGHT + WindowUtils.FLOATING_GAP;
}
```

其中 `FLOATING_TAB_HEIGHT = 60`、`FLOATING_GAP = 12`、`FLOATING_BOTTOM = 4`
（`WindowUtils.ets:194-196`，注释说明「与 MainPage 中常量保持一致」）。
用途：`ProfilePage.ets:167` 的滚动内容底部内边距。

---

## 11. 阅读页：隐藏状态栏与控制字色

### 11.1 进出阅读路由：隐藏/恢复状态栏

```
setSpecificSystemBarEnabled(name: SpecificSystemBar, enable: boolean, enableAnimation?: boolean): Promise<void>
```

| 项 | 官方值 |
|---|---|
| `SpecificSystemBar` 取值 | `'status' \| 'navigation' \| 'navigationIndicator'` —— `arkts-apis-window-t.md:33` |
| 起始版本 | API 11（`enableAnimation` API 12+）—— `arkts-apis-window-window.md:2403` |
| 模型约束 | 仅主窗口生效；子窗口调用后不生效 |

工程把「进出阅读路由」与「状态栏显隐」绑定，**用 Promise 链串行化**避免竞态
（`WindowUtils.ets:40-50`）：

```ts
private static updateReaderStatusBar(): void {
  // 只在进出阅读路由时切换系统栏，工具栏和翻页不改变正文视口。
  WindowUtils.readerStatusBarUpdate = WindowUtils.readerStatusBarUpdate.then(async (): Promise<void> => {
    const win = WindowUtils.mainWindow;
    if (win === null) return;
    await win.setSpecificSystemBarEnabled('status', !WindowUtils.readerActive, false);
    WindowUtils.refreshAvoidArea();
  }).catch((): void => {
    // 窗口销毁或切换期间忽略失败，下次页面切换重新应用。
  });
}
```

触发入口（`WindowUtils.ets:32-38`）：

```ts
static setReaderActive(active: boolean): void {
  if (WindowUtils.readerActive === active) return;   // 幂等
  WindowUtils.readerActive = active;
  // 首次绘制前就使用阅读安全区，不等待系统栏动画或异步回调。
  WindowUtils.refreshAvoidArea();
  WindowUtils.updateReaderStatusBar();
}
```

调用点：
- 路由层：`Index.ets:291-292` 的 `NavDestination().onShown/onHidden`
- 页面层：`ReaderPage.ets:183`（`aboutToAppear` 里 `setReaderActive(true)`）、`:200`（`aboutToDisappear` 里 `false`）

> 即 `readerActive === true` → `setSpecificSystemBarEnabled('status', false, false)` **隐藏状态栏**；
> 退出时 `true` 恢复显示。`enableAnimation` 显式传 `false`，避免动效期间避让高度抖动。

### 11.2 状态栏字色

字色由「当前深浅模式 + 页面诉求」两件事决定（`WindowUtils.ets:110-119`）：

```ts
/**
 * 设置状态栏/导航栏文字色。
 * @param isLight true 强制白字（用于封面/播放器等始终深色背景的页面）；
 *                false 跟随系统深浅色（浅色→黑字，深色→白字）。
 */
static async setStatusBarLight(isLight: boolean): Promise<void> {
  WindowUtils.forceLight = isLight;
  await WindowUtils.applySystemBarContent();
}

/** 与 HDS/Navigation 页面级状态栏样式保持同一套深浅色判断。 */
static getSystemBarContentColor(): string {
  const isDark = WindowUtils.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK;
  return WindowUtils.forceLight || isDark ? '#FFFFFFFF' : '#FF000000';
}
```

实际下发（`WindowUtils.ets:142-149`）：

```ts
private static async applySystemBarContent(): Promise<void> {
  if (!WindowUtils.mainWindow) return;
  const content = WindowUtils.getSystemBarContentColor();
  await WindowUtils.mainWindow.setWindowSystemBarProperties({
    statusBarContentColor: content,
    navigationBarContentColor: content
  });
}
```

各页面诉求：

| 页面 | 调用 | 原因 |
|---|---|---|
| `PlayerPage.ets:208` | `setStatusBarLight(true)` | 播放页恒深色背景 → 强制白字 |
| `PlayerPage.ets:237` | `setStatusBarLight(false)` | 离开恢复跟随系统 |
| `ReaderPage.ets:187, 208` | `setStatusBarLight(false)` | 阅读页跟随系统深浅色 |
| `ReaderPage.ets:688` | `setStatusBarLight(this.palette.isDark)` | 纸张主题切换时同步字色 |
| `MainPage.ets:84` | `setStatusBarLight(false)` | 跟随系统 |
| `BookDetailPage.ets:83, 118` | `setStatusBarLight(false)` | 跟随系统 |
| `HomePage.ets:1100` | `systemBarStyle({ statusBarContentColor: WindowUtils.getSystemBarContentColor() }, …)` | HDS 页面用组件属性而非窗口 API（另一处 `:1165`） |

### 11.3 深浅色模式变更的回流

```
EntryAbility.onConfigurationUpdate(newConfig) → WindowUtils.updateColorMode(newConfig.colorMode)
```
—— `EntryAbility.ets:479-483`

```ts
static updateColorMode(colorMode: ConfigurationConstant.ColorMode): void {
  WindowUtils.colorMode = colorMode;
  WindowUtils.readerColorListeners.forEach((listener: () => void): void => listener());
  WindowUtils.applySystemBarContent().catch(() => { /* ignore */ });
}
```
—— `WindowUtils.ets:136-140`

`readerColorListeners`（`WindowUtils.ets:122, 128-134`）让阅读页在系统深浅色变化时
重新取纸张配色（`ReaderPage.ets:95-100` 的 `readerColorListener`）。
另在 `onForeground` 也补一次 `updateColorMode`，因为「系统颜色可能在后台改变」
（`EntryAbility.ets:530-531`）。

---

## 12. 官方挖孔区适配规则（UX 标准 2.1.2.2）

**标准编号 2.1.2.2「挖孔区适配」，等级「必须」。**

> 标准描述：界面布局需要适配摄像头的挖孔区域，若重要信息或交互操作
> (例如底部页签/顶部页签、工具栏、标题栏、搜索框、输入框、悬浮按钮、横幅通知等)
> 和挖孔区之间有遮挡，则**需要局部避开挖孔区显示**。
> 若重要信息或交互操作和挖孔区无遮挡，则**无需避开挖孔区显示**；
> **悬浮类控件或功能 (例如弹出框、侧边栏等)，无需避开挖孔区显示**；
> **可以上下滚动的内容，例如列表、卡片等无需避开挖孔区显示。**
> 若应用支持横竖屏旋转，则**横竖屏的界面布局均需满足以上挖孔适配要求**。
>
> 测试方法：旋转设备，检查横屏、竖屏下的页签、工具栏、标题栏、搜索框、输入框、按钮、
> 关键文本内容等重要信息及交互操作是否被摄像头挖孔区遮挡。
>
> 判断标准：横竖屏下，界面内容显示正常，布局正常，不出现重要信息或交互操作被挖孔区遮挡的情况，
> **也不出现为了避让挖孔导致不对称的大面积留白**。
>
> —— `references/huawei-docs/design-guides/ux-guidelines-general-0000001760708152.md:68-78`
> （标准索引条目见 `references/huawei-docs/design-guides/ux-standard-overview-0000002019655177.md:34`）
> 官方 URL：https://developer.huawei.com/consumer/cn/doc/design-guides/ux-guidelines-general-0000001760708152

### 12.1 官方给出的实现路径

FAQ「如何完成挖孔屏的适配」（`references/huawei-docs/harmonyos-faqs/faqs-arkui-274.md:19-46`）
给出两步：

1. `setWindowLayoutFullScreen` + `setWindowSystemBarEnable`（隐藏顶部状态栏）；
2. `display.getDefaultDisplaySync()` → `getCutoutInfo()` 拿挖孔区域信息，
   **根据这些信息计算偏移量**，实现对不可用区域的适配。

> 官方 FAQ URL：https://developer.huawei.com/consumer/cn/doc/harmonyos-faqs/faqs-arkui-274

⚠️ 注意 FAQ 用的是 `display.getCutoutInfo()`（display 模块），而
`immersive-window-feature.md:252-278` 的官方示例用的是 `getWindowAvoidArea(TYPE_CUTOUT)`。
**两条路径官方都有，工程采用后者**（`WindowUtils.ets:290`）。

### 12.2 横屏挖孔的四种 Rect

官方示例把挖孔区按四个方向分别落到 `leftRect.width` / `rightRect.width` /
`topRect.height` / `bottomRect.height`（`immersive-window-feature.md:264-279`）。

```ts
private handleCutoutAvoidArea(cutoutAvoidArea: window.AvoidArea): void {
  if (cutoutAvoidArea.topRect.height > 0) { /* 顶部 */ }
  if (cutoutAvoidArea.bottomRect.height > 0) { /* 底部 */ }
  if (cutoutAvoidArea.leftRect.width > 0) { /* 左侧 */ }
  if (cutoutAvoidArea.rightRect.width > 0) { /* 右侧 */ }
}
```
—— 官方示例原文，`immersive-window-feature.md:264-279`

> 工程**未实现左右挖孔避让**（`WindowUtils.syncAvoidArea` 只处理 `topRect` / `bottomRect`，
> `WindowUtils.ets:288-307`），且 `module.json5:49` 的 `orientation` 为
> `auto_rotation_restricted`。是否满足 2.1.2.2 的横屏要求 —— **未证实**，需真机横屏验证。

---

## 13. 反模式

| 反模式 | 为什么错 | 正解 |
|---|---|---|
| 读 `AvoidArea.visible` 判断系统栏是否显示 | 官方明确「没有实际含义，请避免使用此属性」（`immersive-window-feature.md:142`） | 用 `rect.height > 0` 判断；或用 `getWindowStatus()` |
| 把 `topRect.height`（px）直接当 vp 用 | 单位错，高密度屏会偏大 3 倍左右 | `WindowUtils.getStatusBarHeightVp()` 或 `px2vp()` |
| 写死 `padding({ top: 36 })` 之类数值 | 不同设备状态栏/刘海高度不同 | 恒用 `getWindowAvoidArea(TYPE_SYSTEM)` |
| 用 `TYPE_SYSTEM_GESTURE` 取侧边手势区 | 官方：「当前所有设备均无此类型避让区域」（`arkts-apis-window-e.md:91`） | 不实现；侧边用手势系统默认行为 |
| 不调 `setFloatNavigationAvoidAreaEnabled` 就读 `TYPE_FLOAT_NAVIGATION` | 官方：「未调用此接口设置前…直接返回空的三键导航避让区域」（`arkts-apis-window-window.md:2089`） | 先使能（API 26 + `PlatformCompat.supports(26)` 判断） |
| 直接用 `TYPE_FLOAT_NAVIGATION` 而不做版本判断 | API 20–25 设备上该枚举不存在 | `PlatformCompat.supports(26)` 分流（`WindowUtils.ets:283`） |
| 只监听一个事件 | 系统栏显隐/旋转/折叠/分屏各自触发不同事件 | 三事件都监听（`WindowUtils.ets:80-82`） |
| 在窗口切换时不 `off` 旧监听 | 旧窗口持续回调，读到过期避让区 | 先 `off` 三个再绑（`WindowUtils.ets:54-61`） |
| 页面容器写死宽高又加 `expandSafeArea` | 官方：固定宽高时只能向 TOP 和 START 扩展（`ts-universal-attributes-expand-safe-area.md:62`） | 用百分比宽高 |
| 期望 `expandSafeArea` 覆盖挖孔 | 官方：未加 Metadata 时 CUTOUT 类型不生效（`:82`） | 显式走 `TYPE_CUTOUT` 避让 |
| 内层组件加 `expandSafeArea` 就以为传到外层了 | 官方：仅作用于当前组件，不向上/下传递（`:70`） | 每个相关组件单独配置 |
| 在滚动容器里的子组件上设 `expandSafeArea` | 官方：滚动后可能失效（`:69`） | 把属性设在滚动容器自身或按嵌套链逐层设置 |

---

## 14. 官方出处速查

| 主题 | 本地路径（本技能包内） | 官方 URL |
|---|---|---|
| 窗口沉浸式（避让区域计算、AvoidArea 结构） | `references/huawei-docs/harmonyos-guides/immersive-window-feature.md` | `harmonyos-guides/immersive-window-feature` |
| 开发应用沉浸式效果 | `references/huawei-docs/harmonyos-guides/arkts-develop-apply-immersive-effects.md` | 同名 |
| `Window` 接口（getWindowAvoidArea / setWindowLayoutFullScreen / setWindowSystemBarProperties / setSpecificSystemBarEnabled / setFloatNavigationAvoidAreaEnabled / getWindowDensityInfo / on(...)） | `references/huawei-docs/harmonyos-references/arkts-apis-window-window.md` | `harmonyos-references/arkts-apis-window-window` |
| `AvoidAreaType` 枚举 | `references/huawei-docs/harmonyos-references/arkts-apis-window-e.md` | `…/arkts-apis-window-e#avoidareatype7` |
| `AvoidArea` / `SystemBarProperties` / `WindowDensityInfo` | `references/huawei-docs/harmonyos-references/arkts-apis-window-i.md` | `…/arkts-apis-window-i` |
| `SpecificSystemBar` 类型 | `references/huawei-docs/harmonyos-references/arkts-apis-window-t.md` | `…/arkts-apis-window-t` |
| `expandSafeArea` / `SafeAreaType` / `SafeAreaEdge` | `references/huawei-docs/harmonyos-references/ts-universal-attributes-expand-safe-area.md` | 同名 |
| HDS `avoidLayoutSafeArea` | `references/huawei-docs/harmonyos-references/ui-design-hdsnavigation.md` | 同名 |
| 导航条 28vp 抬高 | `references/huawei-docs/design-guides/navigation-0000001957075737.md:63` | `design-guides/navigation-0000001957075737` |
| 多设备屏幕底部边距 28vp | `references/huawei-docs/design-guides/interval-parameter-0000002562577161.md:64` | `design-guides/interval-parameter-0000002562577161` |
| UX 标准 2.1.2.2 挖孔区适配 | `references/huawei-docs/design-guides/ux-guidelines-general-0000001760708152.md:68-78` | `design-guides/ux-guidelines-general-0000001760708152` |
| 挖孔屏适配 FAQ | `references/huawei-docs/harmonyos-faqs/faqs-arkui-274.md` | `harmonyos-faqs/faqs-arkui-274` |

便捷检索：

```bash
node scripts/search-docs.mjs "AvoidAreaType" --catalog harmonyos-references
node scripts/search-docs.mjs "expandSafeArea" --catalog harmonyos-references
node scripts/search-docs.mjs "导航条 28vp" --catalog design-guides
```

---

## 15. 相关分技能

- 沉浸光感材质总览 → [README.md](README.md)
- 主题与外观设置 / 深浅色 → [../theming/README.md](../theming/README.md) *(规划中)*
- 导航条与页签落地 → [../components/README.md](../components/README.md)
- 半模态抽屉 → [../components/sheet.md](../components/sheet.md) *(规划中)*
- 设计规范数值（圆角/间距/字号/标题栏/热区） → [../design-specs.md](../design-specs.md)
- 工程架构与配置模板 → [../project-architecture/README.md](../project-architecture/README.md)

---

## 附：本文标注为「未证实」的结论

1. **「沉浸式设置必须在 `loadContent` 之前，否则首帧标题栏跳动」** —— 工程确实前置并 `await`
   （`EntryAbility.ets:462-476`），但「首帧跳动」的因果结论在官方文档中**未见表述**，
   官方示例反而放在 `loadContent` 回调内（`immersive-window-feature.md:175-189`）。
2. **防抖 32ms / 240ms 双定时** —— 工程实现（`WindowUtils.ets:235-247`），
   官方只要求「避让区域更新时同时更新应用内布局」，未规定数值。
3. **`FALLBACK_BOTTOM_SAFE_VP = 24` 与官方 28vp 的关系** —— 官方（
   `design-guides/navigation-0000001957075737.md:63`、`interval-parameter-0000002562577161.md:64`）
   要求底部抬高 28vp；工程兜底常量是 24vp（`WindowUtils.ets:23`）。
   该 24vp 的来源与合规性**未证实**。
4. **横屏左右挖孔避让** —— 工程未实现（`WindowUtils.ets:288-307` 只处理上下），
   是否满足 UX 标准 2.1.2.2 的横屏要求**未证实**，需真机横屏验证。
5. **`navigationBarColor` 在 HarmonyOS 手机上的实际效果** —— 官方字段表明确写
   「HarmonyOS 各设备不支持此能力」（`arkts-apis-window-i.md:95`），
   工程仍然设置了该字段（`WindowUtils.ets:70`）；实际是否生效**未证实**。
6. **`WindowUtils.density` 初值 3.25** —— 硬编码兜底（`WindowUtils.ets:18`），
   来源**未证实**，不应作为规范值引用。
