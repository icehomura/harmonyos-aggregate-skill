# 沉浸光感（Immersive Light Sense）

> 官方英文名 **Immersive Light Sense**，材质部分称 **Immersive System Material**。
> API 起点：ArkUI `uiMaterial` = **API 26.0.0**；HDS `hdsMaterial` = **6.1.0(23)**。

沉浸光感是 HarmonyOS 的**材质系统**：界面元素不再是实色填充或阴影层叠的平面图层，
而是具备光学扩散与动态透光特性的数字介质。它让悬浮在内容之上的交互组件与内容
在 Z 轴上分层，从而「内容更沉浸，交互更易读」。

## 目录

- [1. 两套 API：先选对](#1-两套-api先选对)
- [2. 材质档位](#2-材质档位)
- [3. 生效范围铁律（最容易踩的坑）](#3-生效范围铁律最容易踩的坑)
- [4. 版本分流与降级](#4-版本分流与降级)
- [5. ImmersiveOptions 参数详解](#5-immersiveoptions-参数详解)
- [6. 选型决策表](#6-选型决策表)
- [7. 功耗约束（官方 8 条）](#7-功耗约束官方-8-条)
- [8. 反模式与常见故障](#8-反模式与常见故障)
- [9. 完整代码示例](#9-完整代码示例)
- [10. 官方 API 速查与出处](#10-官方-api-速查与出处)

---

## 1. 两套 API：先选对

沉浸光感有**两条平行链路**，门槛、参数、能力都不同。选错是最常见的问题源头。

| | **ArkUI `uiMaterial`** | **HDS `hdsMaterial`** |
|---|---|---|
| 来源 | `@kit.ArkUI` | `@kit.UIDesignKit` |
| 起点 | **API 26.0.0** | **6.1.0(23)** |
| 服务对象 | 任意组件的通用属性 `systemMaterial`、弹窗类 options | **仅 HDS 导航与 HDS 底部页签** |
| 档位模型 | `ImmersiveStyle` 五档厚薄 | **无厚薄档位**，由 `materialType` + `materialLevel` 决定 |
| 典型写法 | `new uiMaterial.ImmersiveMaterial({...})` | `systemMaterialEffect: { materialType, materialLevel }` |

**怎么选：**

```
应用使用 HdsNavigation / HdsTabs？
├─ 是 → 这两个组件用 hdsMaterial（走 systemMaterialEffect）
│        其他组件或弹窗用 uiMaterial
└─ 否 → 全部用 uiMaterial
```

官方原文：
> UI Design Kit 支持 HDS 导航和 HDS 底部页签两个组件的沉浸光感能力……
> 如果需要为更多组件或弹窗类组件添加沉浸光感效果，则使用 ArkUI 沉浸光感能力。

> ⚠️ 两套枚举**不可互换**。HDS **不提供**与 `ImmersiveStyle` 对等的厚薄配置。

### HDS 侧枚举（`hdsMaterial`）

```ts
enum MaterialType  { NONE = 0, ADAPTIVE = 100, IMMERSIVE = 101 }
enum MaterialLevel { EXQUISITE = 0, GENTLE = 1, SMOOTH = 2, ADAPTIVE = 10 }
```

- `MaterialType`：`NONE` 无材质 / `ADAPTIVE` 自适应系统材质（默认沉浸式）/ `IMMERSIVE` 沉浸式材质
- `MaterialLevel`：**可主动设置**（不同于 `uiMaterial.MaterialLevel` 只读）。
  `ADAPTIVE` = 由系统按设备性能自适应，**官方推荐写法**。

```ts
import { hdsMaterial } from '@kit.UIDesignKit';

// 官方推荐的通用写法
systemMaterialEffect: {
  materialType: hdsMaterial.MaterialType.ADAPTIVE,
  materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
}
```

### 只读查询接口

```ts
import { uiMaterial } from '@kit.ArkUI';

uiMaterial.getGlobalMaterialLevel()        // 设备算力档（高/中/低）
uiMaterial.isImmersiveMaterialSupported()  // 设备是否支持
uiMaterial.getMaterialInfo()               // 读 module.json5 的应用级配置
hdsMaterial.getSystemMaterialTypes()       // HDS：设备支持的材质类型（PC/2in1 必要）
```

> **PC / 2in1 设备调用 HDS 材质前**必须先 `getSystemMaterialTypes()` 查询，Phone/Tablet 可直接调用。

---

## 2. 材质档位

### `uiMaterial.ImmersiveStyle` 五档

| 枚举 | 值 | **官方中文名** | 官方说明 | 官方推荐场景 |
|---|---|---|---|---|
| `ULTRA_THIN` | 0 | 超薄样式 | 材质层超薄，具有**很强**的透明效果 | 高度透明的背景，如**浮动工具栏** |
| `THIN` | 1 | 薄样式 | 材质层薄，具有**较强**的透明效果 | 较强透明度的场景，如**搜索框** |
| `REGULAR` | 2 | 常规样式 | 厚度常规，具有适度的透明和模糊效果 | **通用场景** |
| `THICK` | 3 | 厚样式 | 材质层厚，**模糊效果较强** | 较强模糊背景的场景，如**菜单** |
| `ULTRA_THICK` | 4 | 超厚样式 | 材质层超厚，**模糊效果很强** | 完全模糊背景的场景，如**弹窗** |

> ⚠️ **术语纠正**：官方中文名是「超薄样式 / 薄样式 / 常规样式 / 厚样式 / 超厚样式」。
> 「超薄通透」「超薄磨砂」等说法**不是官方名称**；官方文档中**从未出现「磨砂」一词**。
> 引用规范时请使用官方称谓。

### 三层档位模型（**容易混淆，务必分清**）

沉浸光感的「档位」在三个不同层面各有一套，**不要混为一谈**：

| 层 | 名称 | 取值 | 谁来定 |
|---|---|---|---|
| **① 视觉强度** | `MaterialLevel`（HDS） | 强 `EXQUISITE` / 均衡 `GENTLE`(默认) / 弱 `SMOOTH` / 自适应 `ADAPTIVE` | **应用可设** + 用户系统设置 |
| **② 材质厚薄** | `ImmersiveStyle`（ArkUI） | `ULTRA_THIN` / `THIN` / `REGULAR` / `THICK` / `ULTRA_THICK` | **开发者声明** |
| **③ 应用外观选项** | 自定义编号 → `ImmersiveStyle` | 「默认」+ 5 档 = **6 个选项** | **终端用户选** |

**① 视觉强度 `MaterialLevel`**（官方最佳实践原文）：

| 档位 | 枚举 | 官方说明 |
|---|---|---|
| **强** | `EXQUISITE` | 完整的沉浸光感效果，包含所有视觉特性，适合高性能设备 |
| **均衡（默认）** | `GENTLE` | 适度的效果，在视觉效果与性能之间取得平衡 |
| **弱** | `SMOOTH` | 轻量级效果，仅保留核心视觉特性，适合低性能设备 |
| **系统自适应** | `ADAPTIVE` | 由系统根据设备性能自动选择，**推荐大多数场景使用** |

> 官方原文：「在绝大多数场景下，建议使用 **ADAPTIVE**（自适应）模式……
> 如果对视觉效果有极高要求，可以手动指定材质类型和级别，例如强制使用 **EXQUISITE**。
> 但必须注意设备兼容性……**强行在低端设备上开启可能导致卡顿和发热**。
> 因此，需要 **`getSystemMaterialTypes()` 先查询设备支持的能力，再进行优雅降级**。」
>
> ⚠️ 亮色模式下 `EXQUISITE` 可能覆盖白色叠层；若底色为非白纯色，可考虑切至 `GENTLE`。

**② 材质厚薄 `ImmersiveStyle`** —— 见上一节五档表。开发者声明，**系统会自动映射到用户强度**。

**③ 应用外观选项**：若应用要提供「材质效果」设置项（终端用户可选），
推荐 **「默认」+ 5 档 = 6 个选项**：

- **「默认」** = 各控件使用**推荐档位**（即不覆盖，保留组件自带的 `fallback`）
- **其余 5 档** = 直接映射 `ImmersiveStyle` 的五个值

> 系统设置里终端用户可见的是**强度三档（强 / 均衡 / 弱）**。
> 官方原文：开发侧「**无需针对用户的三档自定义强度选项分别进行代码适配——
> 系统底层将自动完成参数映射与动态渲染**。只需一次定义，界面即可随用户设置平滑过渡。」

### 沉浸光感的六大视觉特性（官方原文）

| 特性 | 官方说明 |
|---|---|
| **通透材质** | 组件背景呈现毛玻璃效果，内容可透过组件隐约可见，营造层次感与通透感 |
| **渐变模糊** | 标题栏随页面滑动产生渐变模糊效果，从透明到模糊平滑过渡 |
| **按压弹性反馈** | 用户按压组件时产生弹性缩放动画，提供触觉层面的反馈 |
| **按压点光源** | 按压时在触点位置产生光晕扩散效果，增强交互的视觉反馈 |
| **材质流光** | 组件表面呈现微妙的流光效果，随视角和状态变化，提升精致感 |
| **智能反色** | 当底层内容颜色与组件前景色接近时，自动调整前景色以保证可读性 |

### 默认档位（组件自带）

官方为每个组件预置了档位。**符合语义时优先用默认值，不要手动覆盖**：

| 组件 | 默认档位 |
|---|---|
| Navigation 标题栏 | `ULTRA_THIN` |
| 底部页签 Tabs 悬浮样式 | `THIN` |
| 菜单 Menu | `THICK` |
| Toast / AlphabetIndexer 弹窗 | `THICK` |
| Dialog（含 Sheet、各类 Picker） | `ULTRA_THICK` |

---

## 3. 生效范围铁律（最容易踩的坑）

**这一节是沉浸光感最高频的失败原因，务必先读。**

### 通用属性 `systemMaterial` 的生效范围

> 官方原文：指定**弹窗类组件**与**弹窗类接口**、以及 **Slider / Toggle / Select**
> 的沉浸光感效果可在**全页面生效**。
> **其他组件仅在 Navigation/NavDestination 标题栏，或横向 Tabs 中
> `barPosition` 为 `BarPosition.End` 的底部 TabBar 中生效。在其他区域中设置不生效。**

**全页面生效的白名单：**

- **弹窗组件**：AlertDialog、ActionSheet、CustomDialog、CalendarPickerDialog、
  DatePickerDialog、TimePickerDialog、TextPickerDialog、SelectionMenu、
  AlphabetIndexer 弹窗、Text `copyOption` 的文本菜单
- **弹窗接口**：PromptAction、ArkUI_NativeDialog、`@ohos.promptAction`、
  Popup 控制、Tips 控制、菜单控制、半模态转场
- **表单控件**：Slider、Toggle、Select

**不在白名单里的组件**（含 `Column` / `Row` / `Stack` 等自绘容器）**只在
Navigation 标题栏或底部 TabBar 内生效**。

> 失效日志特征：`Material inactive: out of scope. Use component in navigation title bar or Tabbar.`

**实践含义**：想给「首页搜索框」加材质，正确做法是把它放进
`HdsNavigation.titleBar.content.stackBuilder`；放在普通 `Column` 里不会生效。

### 底部页签的额外条件

`Tabs` 的沉浸材质需**同时**满足：

```
.barOverlap(true)  +  .vertical(false)  +  .barPosition(BarPosition.End)
```

否则 `systemMaterial` 不生效。另：**`TabContent` 本身不支持设置沉浸光感**。

---

## 4. 版本分流与降级

### 应用级开关

`module.json5` 的 `metadata`（**仅在 entry 类型 module 生效**）：

```json5
{
  "module": {
    "metadata": [
      { "name": "ohos.arkui.UIMaterial.state", "value": "enable" }
    ]
  }
}
```

`value` 取值：`default` | `enable` | `disable`。
`default` 语义：从 API 26 之前升级到 26+ 且未主动设置时，组件**默认开启**。

**优先级**：组件级 > 应用级。组件级关闭用 `uiMaterial.Material.empty`。

> ⚠️ **关键区别**：`systemMaterial(undefined)` = **恢复组件默认**沉浸光感；
> `systemMaterial(uiMaterial.Material.empty)` = **关闭**沉浸光感。两者不同。

### 代码级版本保护

```ts
import { deviceInfo } from '@kit.BasicServicesKit';

// ✅ 官方推荐（API 26 起），入参必须是字面量
if (deviceInfo.apiAvailable('26.0.0')) {
  // 使用 uiMaterial
} else {
  // 降级方案
}
```

> 工程 `targetSdkVersion` 会高于设备实际 API，**必须用设备能力判断**，
> 不能用编译期常量或 `canIUse`。

### 降级策略（三层）

```ts
// ① 设备支持性判断（最推荐，一套代码自适应）
if (uiMaterial.isImmersiveMaterialSupported()) {
  instance.systemMaterial(material);
} else {
  instance.backgroundColor(fallbackColor).backgroundBlurStyle(fallbackBlur);
}

// ② 算力档判断
const level = uiMaterial.getGlobalMaterialLevel();  // EXQUISITE / GENTLE / SMOOTH

// ③ HDS 侧能力查询（PC/2in1 必需）
const types = hdsMaterial.getSystemMaterialTypes();
// 支持 IMMERSIVE → 可选 EXQUISITE / GENTLE；不支持 → 建议 SMOOTH（降低卡顿发热）
```

> 官方：在不支持的设备上设置 `ImmersiveMaterial`，
> **不会覆盖任何通用属性**，组件样式仍由已设置的通用属性决定 —— 因此
> **务必同时设置好回退样式**（背景色 + 磨砂），否则降级后无样式。

### API 23–25 的沉浸光感

- ArkUI `uiMaterial` **不存在**（API 26 才有）
- 唯一入口是 **HDS `hdsMaterial`**（6.1.0(23)）：`HdsNavigation` / `HdsTabs` 的
  `systemMaterialEffect`
- 若不用 HDS 组件 → 只能用 `backgroundBlurStyle` 磨砂近似，**不是真正的沉浸光感**

---

## 5. ImmersiveOptions 参数详解

```ts
import { uiMaterial } from '@kit.ArkUI';

new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.REGULAR,  // 默认 REGULAR
  materialColor: undefined,
  colorInvert: false,
  applyShadow: true,
  interactive: false,
  lightEffect: undefined,
})
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `style` | `ImmersiveStyle` | `REGULAR` | 材质厚薄。**仅高/中算力生效** |
| `materialColor` | `ResourceColor` | `undefined` | 材质层赋色。**必须带透明度**，传不透明色会遮挡材质；低算力设备上直接作 `backgroundColor` |
| `colorInvert` | `boolean` | `false` | 子树颜色自动反色。**仅高/中算力 + 仅 THIN/ULTRA_THIN**；且**只对资源接口设置的颜色生效**（`$r('sys.color.…')`），硬编码色值不生效 |
| `applyShadow` | `boolean` | `true` | 为 true 时**材质阴影优先于 `shadow` 通用属性** |
| `interactive` | `boolean` | `false` | 交互形变：按压时材质向触点弹性形变 |
| `lightEffect` | `LightEffectOptions \| null` | `undefined` | 触点光感（手指位置作动态光源）。传 `null` 显式禁用 |

**`interactive` + `lightEffect` 是「光感」的灵魂** —— 它们让材质不只是静态模糊，
而是对触摸有响应的活的表面：

> 官方原文：当用户与底部页签中的按钮产生交互时，**指尖位置被定义为动态光源和
> 材质受力点**，向周围材质表面投射光晕，照亮容器边缘，光照强度随距离衰减，
> 同时使容器向手指位置形变。

**光效颜色建议**：官方建议使用组件默认光效属性；如需自定义，用**低透明度、高亮度**的色彩。

---

## 6. 选型决策表

### 按组件类别（官方原文）

| 类别 | 官方推荐档位 | 官方理由 |
|---|---|---|
| **导航类**（Navigation 标题栏、底部页签、索引条） | 较薄（`ULTRA_THIN` / `THIN`） | 「在保持背景通透的同时避免过度遮挡内容」 |
| **弹窗类**（Toast / Popup / Tips / Menu / Dialog） | 较厚（`THICK` / `ULTRA_THICK`） | 「获得更强的背景模糊效果，确保弹窗内容与背景内容之间有清晰的视觉分离」 |
| **按钮与选择类**（Button / Select / Toggle / Slider / Chip / SegmentButton） | 较薄（`ULTRA_THIN` / `THIN`） | 配合交互形变与点光源提供按压反馈 |

### 按组件位置（官方《场景规范》原文）

| 组件形态 | 推荐档位 | 官方补充 |
|---|---|---|
| 顶部悬浮 | `ULTRA_THIN` | 结合**渐变模糊**延展顶部内容展示空间 |
| 底部悬浮 | `THIN` | 结合**渐变颜色蒙层**延展底部内容展示空间 |
| 非常驻、任意位置弹出 | `THICK` | 确保复杂场景下内容的可读性 |
| 半模态、弹出框 | `ULTRA_THICK` | 通常占据面积较大、内容丰富度更强 |

### 何时该用沉浸光感（官方判断标准）

> 「建议，当某些界面操作元素在交互过程中可能存在**与内容区产生重叠**情况时，
> 使用沉浸光感效果能够大幅度提高页面的视觉体验，强化页面 **Z 轴空间感**。」

即：**会与内容重叠的悬浮交互元素**才用。不要为了「好看」滥用。

---

## 7. 功耗约束（官方 8 条）

> 官方总体原则：沉浸光感是**「稀缺」视觉资源**，需**控制面积与层数**、
> **不应固定显示在视频动图动画等变化的内容之上**。

| # | 约束 | 原因 |
|---|---|---|
| 1 | **控制使用面积** —— 推荐只在 Navigation 顶部标题栏和底部 Tabs 区域少量使用 | 面积越大像素越多，功耗越高 |
| 2 | **避免材质嵌套** —— 同一子树只在外层设一次 | 嵌套会重复计算且视觉干扰 |
| 3 | **不叠加背景模糊** —— 材质自带 `materialFilter` 已含模糊，不要再设 `backgroundBlurStyle` / `backgroundEffect` | 重复处理 |
| 4 | **控制弹窗尺寸** —— 避免接近全屏的超大 Dialog / Menu | 强/均衡档下默认带形变动效，开销大 |
| 5 | **避开动态内容** —— 背景是视频/动图时不使用 | 材质层反复重采样重算 |
| 6 | **控制 `colorInvert` 范围** —— 大列表/大树整体开启代价高 | 反色需遍历子树 |
| 7 | **保持材质参数稳定** —— 不要频繁改 `style` / `materialColor`，不要在材质区频繁增删节点 | 触发材质重算 |
| 8 | **避免重复阴影** —— `applyShadow: true` 已提供阴影，不要再设 `shadow` | 冲突且重复绘制 |

> 官方正例尺寸参考：Dialog `328 × 216`（vp）。

---

## 8. 反模式与常见故障

### 反模式清单

| ❌ 不要 | ✅ 应该 |
|---|---|
| 设了 `systemMaterial` 还设 `backgroundColor` | 用 `Color.Transparent` 让材质透出 |
| 设了材质还设 `backgroundBlurStyle` | 只保留材质（自带模糊） |
| 嵌套多层材质 | 只在外层设一次 |
| 把 `systemMaterial` 写在其他样式**之前** | **必须写在其他样式属性之后**（官方 FAQ 明确） |
| `materialColor` 传 `Color.Red` 这类不透明色 | 用 `'rgba(255,0,0,0.2)'` 带透明度 |
| 硬编码 `Color.White` 期待 `colorInvert` 反色 | 用 `$r('sys.color.…')` 资源色 |
| 在普通 `Column` 里设材质期待生效 | 放进 Navigation 标题栏 / 底部 TabBar |
| 材质上再叠 `shadow` | 用 `applyShadow` 控制 |

### 故障对照表

| 现象 | 原因与解法 |
|---|---|
| 完全看不到材质 | 组件不在生效范围。查日志 `Material inactive: out of scope.` |
| 材质被"盖住" | 设了 `backgroundColor` / `backgroundBlurStyle`，改为 `Color.Transparent` 并移除模糊 |
| 边框呈现周围背景色 | **正常光学表现**（折射特性）。可改用较厚样式或加 `materialColor` |
| 传 `materialColor` 后材质消失 | 颜色不透明，必须带透明度 |
| 低算力设备效果差很多 | 低算力下 **`style` 与 `colorInvert` 完全不生效**，仅影响背景色/边框色/边框宽/阴影 |
| `colorInvert` 文字不变色 | 需同时满足：高/中算力 + `THIN`/`ULTRA_THIN` + **资源接口颜色** + 系统强度足够 |
| 设了 `systemMaterial` 样式异常 | **移到其他样式属性之后** |
| Dialog/Toast 在 `default` 模式下无材质 | 仅当**未设**背景色/模糊/阴影时才默认开启 |
| 材质渲染区域与预期不符 | 材质区域由**布局区域**决定，用 `width`/`height`/`borderRadius` 对齐 |
| `TextArea` 设背景色后材质被遮 | 内容层在背板层之上，内容层背景会遮盖材质 |

### 视觉层级（官方原文）

> 沉浸光感的视觉层级位于组件的 `backgroundColor`、`backgroundBlurStyle` 等属性**之下**。
> 自绘制组件的背景色作用于内容层，材质效果作用于**背板层**，内容层位于背板层之上。

自下而上：**内容 → 材质背板层 → 组件背景色/模糊层 → 组件内容层**。

---

## 9. 完整代码示例

### 9.1 ArkUI：THIN + 交互形变 + 点光源（最小可用）

```ts
import { uiMaterial } from '@kit.ArkUI';

@Entry
@Component
struct ImmersiveTabsExample {
  build() {
    Column() {
      Tabs({ barPosition: BarPosition.End }) {
        TabContent() {
          Image($r('app.media.bg')).width('100%').height('100%').objectFit(ImageFit.Cover)
        }.tabBar(new BottomTabBarStyle($r('sys.media.ohos_icon_mask_svg'), '首页'))

        TabContent() {
          Column().width('100%').height('100%').backgroundColor(Color.Green)
        }.tabBar(new BottomTabBarStyle($r('sys.media.ohos_icon_mask_svg'), '设置'))
      }
      .barOverlap(true)          // ← 三个条件缺一不可
      .vertical(false)
      .barPosition(BarPosition.End)
      .barFloatingStyle({
        adaptToHandedness: true,
        maskHeight: 0,
        systemMaterial: new uiMaterial.ImmersiveMaterial({
          style: uiMaterial.ImmersiveStyle.ULTRA_THIN,
          interactive: true,   // 交互形变
          lightEffect: {},     // 触点光感（默认白色）
        }),
      })
      .height('100%')
    }
    .width('100%').height('100%')
  }
}
```

### 9.2 自动反色

```ts
systemMaterial: new uiMaterial.ImmersiveMaterial({
  style: uiMaterial.ImmersiveStyle.ULTRA_THIN,  // 反色仅 THIN/ULTRA_THIN
  colorInvert: true,
})
```
> 反色**只对资源接口颜色生效**。用 `$r('sys.color.font_primary')`，不要用 `Color.White`。

### 9.3 通用属性 + 回退（推荐的生产写法）

```ts
import { uiMaterial } from '@kit.ArkUI';
import { PlatformCompat } from '../utils/PlatformCompat';

// 组件上：材质放在其他样式之后
Column() { /* 内容 */ }
  .width(120).height(40)
  .borderRadius(999)
  .backgroundColor(Color.Transparent)     // 不能是实色
  .attributeModifier(AppMaterial.modifier(AppMaterial.InteractiveClean))
```

`AttributeModifier` 内做版本分流：

```ts
class CompatibleMaterialModifier implements AttributeModifier<CommonAttribute> {
  applyNormalAttribute(instance: CommonAttribute): void {
    if (PlatformCompat.immersiveMaterial && this.material !== undefined) {
      instance.systemMaterial(this.material);          // API 26+
    } else {
      instance.backgroundColor(this.fallbackColor)     // 旧设备回退
        .backgroundBlurStyle(this.blur);
    }
  }
}

// 能力判断只认设备实际 API
export class PlatformCompat {
  static supports(apiVersion: number): boolean {
    return deviceInfo.sdkApiVersion >= apiVersion;
  }
  static get immersiveMaterial(): boolean { return PlatformCompat.supports(26); }
  static get floatingTabs(): boolean { return PlatformCompat.supports(23); }
}
```

### 9.4 HDS：导航栏 + 浮动页签

```ts
import { hdsMaterial } from '@kit.UIDesignKit';

// 导航标题栏
.titleBar({
  content: { title: { mainTitle: '首页' }, menu: this.menus },
  style: {
    scrollEffectOpts: {
      enableScrollEffect: false,
      scrollEffectType: ScrollEffectType.GRADIENT_BLUR,
    },
    systemMaterialEffect: {
      materialType: hdsMaterial.MaterialType.ADAPTIVE,
      materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
    },
  },
})

// 底部浮动页签
.barOverlap(true).vertical(false).barPosition(BarPosition.End)
.barFloatingStyle({
  barBottomMargin: 28,
  systemMaterialEffect: {
    materialType: hdsMaterial.MaterialType.ADAPTIVE,
    materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
  }
})
```

### 9.5 材质工厂（缓存 + 响应式）

```ts
export class AppMaterial {
  private static cache: Map<string, uiMaterial.Material> = new Map();
  private static appearanceKey: string = '';

  private static material(key: string, fallback: uiMaterial.ImmersiveStyle,
    shadow: boolean, interactive: boolean, invert = false, fixed = false): uiMaterial.Material {
    const appearanceKey = `${AppAppearance.current.material}:${AppAppearance.current.accent}`;
    if (appearanceKey !== AppMaterial.appearanceKey) {
      AppMaterial.cache.clear();          // 档位或主题色变了，整表失效
      AppMaterial.appearanceKey = appearanceKey;
    }
    // ⚠️ 即使缓存命中也要读一次响应式 token，
    //    否则 V2 不会把该组件登记为 accent 的依赖者，换色后不刷新。
    const lightColor: ResourceColor = AppColor.Brand;
    const cached = AppMaterial.cache.get(key);
    if (cached !== undefined) return cached;
    const mat = new uiMaterial.ImmersiveMaterial({
      style: fixed ? fallback : AppMaterial.resolveStyle(fallback),
      applyShadow: shadow,
      interactive: interactive,
      colorInvert: invert,
      lightEffect: { color: lightColor },   // 光感色 = 主题色
    });
    AppMaterial.cache.set(key, mat);
    return mat;
  }
}
```

---

## 10. 官方 API 速查与出处

### 常见误记

| 误记 | 实际 |
|---|---|
| `backgroundMaterial` | ❌ **不存在**。全量官方文档 0 命中 |
| `HdsMaterial`（大写 H） | ❌ 官方只有小写 `hdsMaterial` |
| 「超薄通透 / 超薄磨砂 / 厚磨砂」 | ❌ 官方是「超薄样式 / 薄样式 / 厚样式」 |
| `HdsNavigation` 顶层 `menus` / `scrollEffect` | ❌ 实际在 `titleBar.content.menu` / `titleBar.style.scrollEffectOpts` |

### 官方文档出处

| 主题 | 本地路径（爬取副本） | 官方 URL |
|---|---|---|
| 沉浸光感简介 | `references/huawei-docs/harmonyos-guides/arkts-immersive-light-sense-overview.md` | `harmonyos-guides/arkts-immersive-light-sense-overview` |
| 开启沉浸光感 | `…/arkts-immersive-light-sense-enable.md` | 同名 |
| 组件适配（**生效范围表**） | `…/arkts-immersive-light-sense-component-adaptation.md` | 同名 |
| 材质视效能力 | `…/arkts-immersive-light-sense-common-capability.md` | 同名 |
| **功耗优化** | `…/arkts-immersive-light-sense-constraints.md` | 同名 |
| **常见问题 FAQ** | `…/arkts-immersive-light-sense-faq.md` | 同名 |
| 典型场景示例 | `…/arkts-immersive-light-sample.md` | 同名 |
| `@ohos.arkui.uiMaterial` | `references/huawei-docs/harmonyos-references/arkts-apis-uimaterial.md` | 同名 |
| `hdsMaterial` | `references/huawei-docs/harmonyos-references/ui-design-hdsmaterial.md` | 同名 |
| `HdsNavigation` | `references/huawei-docs/harmonyos-references/ui-design-hdsnavigation.md` | 同名 |
| HDS 沉浸光感 | `references/huawei-docs/harmonyos-guides/ui-design-hds-component-material.md` | 同名 |

> 用 `node scripts/search-docs.mjs "关键词"` 可全文检索，比记路径快。

### 相关分技能

- 安全区 / 刘海避让 → [safe-area.md](safe-area.md)
- 主题与外观设置 → [../theming/README.md](../theming/README.md)
- 导航条与页签落地 → [../components/README.md](../components/README.md)
- 半模态抽屉材质 → [../components/sheet.md](../components/sheet.md)
- 设计规范数值 → [../design-specs.md](../design-specs.md)
