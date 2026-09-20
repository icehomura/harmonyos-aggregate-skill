# 自定义背景图主题

> **用途**：让用户选一张相册图片作为阅读背景，并调节**蒙层浓度 / 模糊度 / 暗度**，
> 且跟随系统深浅色自动适配。
>
> **重要前提**：真实工程**只实现了「蒙层浓度」**，**没有**模糊度与独立暗度。
> 本文分两部分：**§2–§6 是项目实测**（可直接复刻），
> **§7 是模糊度与暗度的扩展设计**（用户需求，项目未实现，为新增建议）。

---

## 目录

- [1. 结论速览](#1-结论速览)
- [2. 完整实现链](#2-完整实现链)
- [3. 选图与落盘](#3-选图与落盘)
- [4. 渲染结构](#4-渲染结构)
- [5. 蒙层（项目已实现）](#5-蒙层项目已实现)
- [6. 深浅色跟随](#6-深浅色跟随)
- [7. 扩展：模糊度与暗度](#7-扩展模糊度与暗度)
- [8. 旧数据迁移](#8-旧数据迁移)
- [9. 未证实清单](#9-未证实清单)
- [10. 相关分技能](#10-相关分技能)

---

## 1. 结论速览

| 项 | 项目现状 | 出处 |
|---|---|---|
| 选图 API | `photoAccessHelper.PhotoViewPicker` | `ReaderPage.ets:12, 797-808` |
| 存储 | `${filesDir}/reader_bg/bg_<timestamp>.jpg` | `ReaderPage.ets:809-824` |
| 正文存路径 | preferences 存**沙箱绝对路径** | `TextReadingSettingsService.ets:12-13` |
| 渲染 | `ReaderBackground`：底色 → Image(Cover) → 蒙层 | `ReaderBackground.ets:16-34` |
| **蒙层** | 独立 `Column` + `.opacity(overlayAlpha)` | `ReaderBackground.ets:26-30` |
| 蒙层参数 | `overlayAlpha`，默认 **0.35**，范围 **0–0.85** | `TextReading.ets:64-67` |
| 模糊度 | ❌ **未实现** | — |
| 暗度 | ❌ **未实现** | — |
| 深浅色跟随 | `followSystemTheme` 开关 + `WindowUtils.isDarkMode()` | `ReaderPage.ets:676-689` |
| 系统深色时的行为 | **隐藏背景图**，强制 Night 纯色底 | `ReaderPage.ets:1325,1440` |

> **结论**：项目对背景图只做了「用底色压一层」这一种处理。
> 用户要求的**模糊度**与**暗度**需要在 §7 的扩展方案中新增。

---

## 2. 完整实现链

```
用户点击「自定义图片」色块
   ↓
photoAccessHelper.PhotoViewPicker.select()     选 1 张图
   ↓
fileIo.copyFile → filesDir/reader_bg/bg_<ts>.jpg     落沙箱
   ↓
image.createImageSource(dest).getImageInfo()    校验可解码
   ↓
TextReadingSettingsService.save()               持久化路径 + 蒙层浓度
   ↓
ReaderBackground 渲染：底色 → Image(Cover) → 蒙层(opacity)
```

---

## 3. 选图与落盘

### 选图

```ts
import { photoAccessHelper } from '@kit.MediaLibraryKit';

private async pickBackgroundImage(): Promise<void> {
  const options = new photoAccessHelper.PhotoSelectOptions();
  options.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
  options.maxSelectNumber = 1;
  const result = await new photoAccessHelper.PhotoViewPicker().select(options);
  if (result.photoUris.length === 0) return;
  // ... 落盘
}
```
出处：`ReaderPage.ets:797-808`

> **必须落本地副本**：相册 `uri` 是**临时授权，重启后失效**（源码注释明确说明）。

### 落盘 + 可解码性校验

```ts
const dir = `${currentContext.filesDir}/reader_bg`;
if (!await fileIo.access(dir)) await fileIo.mkdir(dir, true);   // 递归创建
const destination = `${dir}/bg_${Date.now()}.jpg`;

const src = await fileIo.open(result.photoUris[0], fileIo.OpenMode.READ_ONLY);
try {
  await fileIo.copyFile(src.fd, destination);
} finally {
  await fileIo.close(src);
}

// 验证可解码后再替换主题；失败则保留原图与设置
const imageSource = image.createImageSource(destination);
try {
  await imageSource.getImageInfo();
} finally {
  await imageSource.release();
}
```
出处：`ReaderPage.ets:809-824`

### 状态更新的顺序（重要）

```ts
const previous = this.bgImagePath;
if (this.themeId !== ReaderThemeId.Image) {
  this.customBackground = this.palette.background;   // ① 过继旧底色作蒙层色
}
this.bgImagePath = destination;
this.followSystemTheme = false;                      // ② 选图即关闭跟随系统
this.themeId = ReaderThemeId.Image;
this.backgroundPattern = ReaderPattern.Image;
this.refreshPalette();
await TextReadingSettingsService.save(currentContext, settings);  // ③ 先落盘
if (previous.length > 0 && previous !== destination) {
  fileIo.unlink(previous).catch(() => {});           // ④ 落盘成功后才删旧图
}
```
出处：`ReaderPage.ets:825-857`

**四条设计要点**：

1. **「过继」底色** —— 若原主题不是图片主题，把当前主题底色存为蒙层色，
   保证换图后蒙层色调延续（`ReaderPage.ets:827`）
2. **选图强制关闭「跟随系统」** —— 否则系统深色时图片会被隐藏，用户看不到刚选的图
3. **先落盘成功再删旧图** —— 避免重启后引用已删文件
4. **失败时清理孤立文件** —— `finally` 里 `unlink(destination)`（`:854-856`）

### 并发保护

```ts
private pickingBackgroundImage: boolean = false;   // 布尔锁防重入
```
出处：`ReaderPage.ets:85, 799, 852`

---

## 4. 渲染结构

`ReaderBackground` 组件（**阅读页与设置预览共用**）：

```ts
@ComponentV2
export struct ReaderBackground {
  @Param palette: ReaderPalette = new ReaderPalette();
  @Param pattern: string = ReaderPattern.None;
  @Param bgImagePath: string = '';        // 持久化存沙箱路径
  @Param overlayAlpha: number = 0.35;

  build() {
    Stack() {
      // ① 底色（纯色主题时唯一可见层）
      Column()
        .width('100%').height('100%')
        .backgroundColor(this.palette.background)

      // ② 背景图
      if (this.pattern === ReaderPattern.Image && this.bgImagePath.length > 0) {
        Image(fileUri.getUriFromPath(this.bgImagePath))    // 显示时才转 file:// URI
          .width('100%').height('100%')
          .objectFit(ImageFit.Cover)
          .interpolation(ImageInterpolation.Medium)

        // ③ 蒙层：底色 + opacity
        Column()
          .width('100%').height('100%')
          .backgroundColor(this.palette.background)
          .opacity(this.overlayAlpha)
      }
    }
    .width('100%').height('100%')
    .hitTestBehavior(HitTestMode.None)     // ← 不吞翻页手势
  }
}
```
出处：`ReaderBackground.ets:5-37`

**三个关键点**：

| 点 | 说明 |
|---|---|
| **沙箱路径 → `file://` URI** | 只在显示时用 `fileUri.getUriFromPath()` 转换；持久化存原始路径 |
| **`hitTestBehavior(None)`** | 背景层不拦截手势，否则翻页/点击失效 |
| **`ImageInterpolation.Medium`** | 插值质量，避免大图缩放的锯齿 |

**调用点**（三处）：
- EPUB 根背景层（`ReaderPage.ets:1323-1328`）
- 在线文本每页背景（`ReaderPage.ets:1438-1443`）
- 设置页 160vp 实时预览（`ReaderSettingsSheet.ets:192-197`）

---

## 5. 蒙层（项目已实现）

### 参数定义

```ts
/** 背景图蒙层浓度：0 = 图片原样，0.85 = 几乎被底色盖住 */
static readonly OVERLAY_MIN: number = 0;
static readonly OVERLAY_MAX: number = 0.85;
static readonly OVERLAY_DEFAULT: number = 0.35;
```
出处：`TextReading.ets:64-67`

### 归一化

```ts
static normalizeOverlay(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return TextReadingSettings.OVERLAY_DEFAULT;
  const clamped = Math.max(TextReadingSettings.OVERLAY_MIN,
    Math.min(TextReadingSettings.OVERLAY_MAX, value));
  return Math.round(clamped * 100) / 100;     // 保留 2 位小数
}
```
出处：`TextReading.ets:153-158`

### UI：滑杆（界面显示 0%–85%）

```ts
Row({ space: AppSpace.Sm }) {
  Text('蒙层').fontSize(AppFont.Caption).width(30)
  Slider({
    value: this.overlayAlpha * 100,                 // 内部 0–1 → 界面 0–100
    min: TextReadingSettings.OVERLAY_MIN * 100,
    max: TextReadingSettings.OVERLAY_MAX * 100,
    step: 1,
    style: SliderStyle.InSet,
  })
    .layoutWeight(1).height(32)
    .blockColor(AppColor.OnBrand)
    .trackColor($r('sys.color.comp_divider'))
    .selectedColor(AppColor.Brand)
    .onChange((value: number, mode: SliderChangeMode) => {
      // 拖动过程不落盘，松手才写 —— 避免高频写盘
      this.onOverlayChange(value / 100,
        mode === SliderChangeMode.End || mode === SliderChangeMode.Click);
    })
  Text(`${Math.round(this.overlayAlpha * 100)}%`)
}
```
出处：`ReaderSettingsSheet.ets:429-463`

**文案**：
- 标签「蒙层」
- 提示「蒙层越浓，图片越淡，正文越清楚」

> **commit 语义**：拖动中不落盘，`End` / `Click` 才写 preferences
> （`ReaderPage.ets:773-776`）。

### ⚠️ 一个反直觉的行为

**蒙层色 = 底色，不是黑色**。默认 `customBackground = #F5F2EA`（羊皮纸），
所以**新手第一次选图，蒙层是奶白色，85% 时画面接近奶白而非变暗**。

只有在「从夜间主题切到图片主题」时，底色被过继为深色，
蒙层才会起**压暗**作用（`ReaderPage.ets:827`）。

**这意味着「暗度」在项目里是不存在的独立概念** —— 见 §7.2。

---

## 6. 深浅色跟随

### 开关

```ts
// 持久化 key: follow_system_theme，默认 false
Text('跟随系统深浅色')
Toggle({ type: ToggleType.Switch, isOn: this.followSystemTheme })
  .selectedColor(AppColor.Brand)
  .onChange((enabled: boolean) => this.onFollowSystemChange(enabled))
```
出处：`ReaderSettingsSheet.ets:356-362`

> 开启时**所有预设色块的选中态被压制**：
> `selected: !this.followSystemTheme && this.themeId === preset.id`（`:369`）

### 系统深浅色探测

**不用** `@StorageProp('colorMode')` / `Environment` / `getColorMode()`，
而是项目自建的静态状态 + 监听器：

```ts
// WindowUtils.ets
private static colorMode: ConfigurationConstant.ColorMode = COLOR_MODE_LIGHT;
private static readerColorListeners: Set<() => void> = new Set();

static isDarkMode(): boolean {
  return WindowUtils.colorMode === ConfigurationConstant.ColorMode.COLOR_MODE_DARK;
}

static updateColorMode(colorMode: ConfigurationConstant.ColorMode): void {
  WindowUtils.colorMode = colorMode;
  WindowUtils.readerColorListeners.forEach((l) => l());   // 通知订阅者
  WindowUtils.applySystemBarContent().catch(() => {});
}
```
出处：`WindowUtils.ets:25, 124-140`

**写入源**：
- `EntryAbility.onConfigurationUpdate`（系统切换时）
- `EntryAbility` 首帧
- `SettingsPage` 手动切模式时（`WindowUtils.updateColorMode(mode)`）

### 核心逻辑：`refreshPalette()`

```ts
private refreshPalette(): void {
  const systemDark = WindowUtils.isDarkMode();
  this.systemNightOverride = this.followSystemTheme && systemDark;
  // 系统夜间只覆盖显示，不改写用户保存的图片、蒙层和白天主题

  const daytimeTheme = (this.themeId === ReaderThemeId.Night || this.themeId === ReaderThemeId.Black)
    ? ReaderThemeId.Parchment : this.themeId;

  const effectiveTheme = this.followSystemTheme
    ? (this.systemNightOverride ? ReaderThemeId.Night : daytimeTheme)
    : this.themeId;

  this.palette = resolvePalette(effectiveTheme, this.customBackground);
  WindowUtils.setStatusBarLight(this.palette.isDark).catch(() => {});   // 状态栏字色
}
```
出处：`ReaderPage.ets:676-689`

**三条规则**：

1. 系统深色 + 开关开 → **强制 Night 主题**
2. 系统浅色 + 开关开 → 用 `daytimeTheme`（**夜间/纯黑降级为羊皮纸**，图片等其他主题保持）
3. `systemNightOverride` **只影响显示，不回写** `themeId` / `bgImagePath` / `overlayAlpha`

### 系统深色时隐藏背景图

```ts
// 三个渲染点统一处理
pattern: this.systemNightOverride ? ReaderPattern.None : this.backgroundPattern,
```
出处：`ReaderPage.ets:1325, 1440, 1696`

```ts
// ReaderKit（EPUB）路径
themeBgImg: !this.systemNightOverride && this.backgroundPattern === ReaderPattern.Image
  ? this.bgImagePath : '',
```
出处：`ReaderPage.ets:722`

> **官方无此规定**，这是项目为保证可读性做的设计：Night 纯色底 +
> 深色图上的蒙层对比度不可控，直接隐藏更稳妥。

---

## 7. 扩展：模糊度与暗度

> ⚠️ **本节是新增设计建议，项目未实现。** 对接手开发的人有用，但**不要**
> 把它当作既有实现的描述。

### 7.1 现有能力回顾

| 能力 | 现状 |
|---|---|
| 蒙层浓度 | ✅ 0–0.85，底色叠加 |
| 图片模糊 | ❌ 无 |
| 独立暗度 | ❌ 无（被"蒙层色恰好是深色"间接覆盖） |

### 7.2 设计方案：三参数模型

建议扩展为**三个正交参数**，各自独立可调：

```ts
// 在 TextReadingSettings 中新增
/** 背景图模糊半径（vp）：0 = 不模糊 */
blurRadius: number = 0;          // 建议范围 0–30，默认 0
/** 背景图暗度：0 = 不压暗，1 = 全黑 */
dimAlpha: number = 0;            // 建议范围 0–0.6，默认 0
// overlayAlpha 保持现状（底色蒙层）
```

**三层的叠加顺序**（自下而上）：

```
① 底色 Column（纯色兜底）
② Image（背景图）          ← 在此层应用 .blur(blurRadius)
③ 压暗层 Column（纯黑 + dimAlpha opacity）      ← 新增
④ 底色蒙层 Column（palette.background + overlayAlpha opacity）  ← 已有
⑤ 正文
```

**为什么压暗层要用纯黑而不是复用底色**：
`overlayAlpha` 的语义是「底色覆盖度」，用深色底时会同时变暗，
但那是**副产物**而非可控参数。独立的黑色压暗层让「暗度」与「主题底色」解耦：

| 需求 | 用哪个参数 |
|---|---|
| 图片太花，想让正文更清楚 | `overlayAlpha` ↑（用底色压） |
| 图片太亮，想整体压暗 | `dimAlpha` ↑（用黑色压） |
| 图片细节太杂，想柔化 | `blurRadius` ↑ |

### 7.3 实现（改动点）

**① 渲染层**（`ReaderBackground.ets`）：

```ts
if (this.pattern === ReaderPattern.Image && this.bgImagePath.length > 0) {
  Image(fileUri.getUriFromPath(this.bgImagePath))
    .width('100%').height('100%')
    .objectFit(ImageFit.Cover)
    .interpolation(ImageInterpolation.Medium)
    .blur(this.blurRadius)                    // ← 新增：模糊
    .animation({ duration: 150, curve: Curve.EaseOut })   // 拖动时不抖动

  // 新增：压暗层
  if (this.dimAlpha > 0) {
    Column()
      .width('100%').height('100%')
      .backgroundColor(Color.Black)
      .opacity(this.dimAlpha)
  }

  // 已有：底色蒙层
  Column()
    .width('100%').height('100%')
    .backgroundColor(this.palette.background)
    .opacity(this.overlayAlpha)
}
```

> **`.blur()` 的性能提醒**：模糊是 GPU 密集操作。官方《高效使用模糊》建议
> 避免在大面积、持续变化的元素上使用。背景图是静态的，**可以接受**，
> 但应注意：① 拖动滑杆时加 `.animation()` 平滑，避免逐帧重算；
> ② 模糊半径不宜过大（建议 ≤30vp）；③ 低端设备可通过
> `uiMaterial.getGlobalMaterialLevel()` 判断后禁用。

**② 深浅色自动适配**（用户明确要求「跟随系统深浅色调」）：

```ts
// 系统深色时自动加大暗度与模糊，减轻夜间刺眼
@Computed
get effectiveDimAlpha(): number {
  if (!this.followSystemTheme) return this.dimAlpha;
  return WindowUtils.isDarkMode()
    ? Math.min(0.6, this.dimAlpha + 0.25)     // 深色：额外压暗
    : this.dimAlpha;
}

@Computed
get effectiveBlurRadius(): number {
  if (!this.followSystemTheme) return this.blurRadius;
  // 深色下适度柔化高光，避免夜间刺眼
  return WindowUtils.isDarkMode() ? Math.max(this.blurRadius, 8) : this.blurRadius;
}
```

> **`followSystemTheme` 语义扩展**：原实现中它只控制「夜间主题覆盖」；
> 扩展后它还控制「模糊/暗度的深浅色自适应」。两者语义一致（都是"跟随系统"）。

**③ 设置项**（`ReaderSettingsSheet.ets`，与蒙层滑杆并列）：

```ts
// 蒙层（已有）
this.imageSlider('蒙层', this.overlayAlpha, 0, 0.85, (v, commit) => this.onOverlayChange(v, commit))
// 模糊（新增）
this.imageSlider('模糊', this.blurRadius, 0, 30, (v, commit) => this.onBlurChange(v, commit))
// 暗度（新增）
this.imageSlider('暗度', this.dimAlpha, 0, 0.6, (v, commit) => this.onDimChange(v, commit))
```

**④ 持久化**（`TextReadingSettingsService.ets`）：

```ts
const KEY_BLUR_RADIUS = 'background_blur_radius';
const KEY_DIM_ALPHA = 'background_dim_alpha';
// 读：store.getSync(KEY_BLUR_RADIUS, 0) / getSync(KEY_DIM_ALPHA, 0)
// 写：normalize 后 putSync（与 overlayAlpha 同样做 clamp + 2 位小数）
```

### 7.4 与「跟随系统」的交互矩阵

| followSystemTheme | 系统模式 | 效果 |
|---|---|---|
| `false` | 任意 | 用用户设的 `blurRadius` / `dimAlpha` / `overlayAlpha` 原值 |
| `true` | 浅色 | 同上原值 |
| `true` | 深色 | **隐藏图片**（现有行为）+ 强制 Night 主题 |

> 若采用 §7.3 的「深色额外压暗」方案，则 `true` + 深色时**不再隐藏图片**，
> 而是靠 `effectiveDimAlpha` 保证可读性。**两种策略二选一**：
>
> - **策略 A（现行）**：深色下隐藏图片，最稳妥，但用户选的图在夜间看不到
> - **策略 B（扩展）**：深色下保留图片 + 压暗，视觉连续性好，但要验证对比度
>
> 建议默认沿用 A（保持与现有行为一致），把 B 作为可选开关暴露。

---

## 8. 旧数据迁移

### id 归一化

```ts
static normalizeThemeId(value: string): string {
  if (typeof value !== 'string' || value.length === 0) return THEME_DEFAULT;
  if (value === ReaderThemeId.Paper) return ReaderThemeId.Parchment;   // paper → parchment
  if (value === ReaderThemeId.Black) return ReaderThemeId.Night;       // black → night
  if (value === ReaderThemeId.Custom || value === ReaderThemeId.Image) return value;
  return findThemePreset(value) !== null ? value : THEME_DEFAULT;
}
```
出处：`TextReading.ets:138-144`

### pattern 归一化（paper / cloth 一律丢弃）

```ts
static normalizePattern(value: string): string {
  if (value === ReaderPattern.Image || value === ReaderPattern.None) return value;
  return ReaderPattern.None;      // 旧纹理图案全部丢弃
}
```
出处：`TextReading.ets:146-151`

### 核心迁移：旧「主题 + 相册图案」→ 图片主题

```ts
// 旧版是「预设主题」+「相册图案」两个独立维度；新版只保留一个图片主题
if (value.pattern === ReaderPattern.Image && value.backgroundImage.length > 0
  && value.themeId !== ReaderThemeId.Image) {
  // 把旧主题的底色固化为蒙层底色
  value.customBackground = resolvePalette(value.themeId, value.customBackground).background;
  value.themeId = ReaderThemeId.Image;
}
// custom 主题被淘汰 → 回落羊皮纸
if (value.themeId === ReaderThemeId.Custom
  || (value.themeId === ReaderThemeId.Image && value.backgroundImage.length === 0)) {
  value.themeId = TextReadingSettings.THEME_DEFAULT;
}
// pattern 由 themeId 反向强制同步，杜绝不一致
value.pattern = value.themeId === ReaderThemeId.Image ? ReaderPattern.Image : ReaderPattern.None;
```
出处：`TextReading.ets:111-136`

### 启动时校验文件存在

```ts
this.bgImagePath = settings.backgroundImage;
if (this.bgImagePath.length > 0 && !await fileIo.access(this.bgImagePath)) {
  this.bgImagePath = '';                                    // 文件被清掉了
  this.backgroundPattern = ReaderPattern.None;
  if (this.themeId === ReaderThemeId.Image) this.themeId = TextReadingSettings.THEME_DEFAULT;
}
```
出处：`ReaderPage.ets:639-645`

> 用户清理系统缓存后，图片没了但 preferences 还留着路径 —— 这里兜住。

---

## 9. 未证实清单

| # | 条目 | 状态 |
|---|---|---|
| 1 | **背景图模糊度** | ❌ 项目**未实现**，§7 是扩展建议 |
| 2 | **独立暗度参数** | ❌ 项目**未实现**，「变暗」只是蒙层色为深色时的副作用 |
| 3 | `.jpg` 硬编码扩展名 | 项目实现（`ReaderPage.ets:811`），原图 PNG/HEIC 也存成 `.jpg` 后缀，透明通道表现依赖解码器 |
| 4 | 蒙层默认色 `#F5F2EA` 是「提亮」而非「压暗」 | 项目行为，非设计意图；见 §5 的反直觉说明 |
| 5 | 背景图不提取主色 | 项目未做（`ColorPickerUtils` 只服务播放器环境光，阅读页从未调用） |
| 6 | `reader_bg` 目录无上限/无定期清理 | 项目实现：每次选新图删旧图，但切回预设主题不删 |
| 7 | 官方是否给出阅读背景图的规范 | ⚠️ 官方设计指南**无**「阅读背景图」专章 |

---

## 10. 相关分技能

- 阅读主题预设与配色推导 → [../theming/README.md](README.md)
- `bindSheet` 抽屉写法（设置面板） → [../components/sheet.md](../components/sheet.md)
- 安全区（阅读页全屏与状态栏隐藏） → [../immersive-material/safe-area.md](../immersive-material/safe-area.md)
