# 主题与外观设置（Theming）

> **用途**：实现「设置 → 外观」分组（**主题模式 / 材质效果 / 主题色**）与
> 「设置 → 启动」分组（**默认打开**），以及全局主题色如何驱动全 App 换色。
> 这是**用户明确要求的三项 + 启动页**，也是沉浸光感应用的标准配置面。

---

## 目录

- [1. 结论速览](#1-结论速览)
- [2. 档位模型：三层要分清](#2-档位模型三层要分清)
- [3. 主题模式（3 种）](#3-主题模式3-种)
- [4. 材质效果（6 个选项）](#4-材质效果6-个选项)
- [5. 主题色（6 预设 + 1 自定义）](#5-主题色6-预设--1-自定义)
- [6. 启动分组（默认打开）](#6-启动分组默认打开)
- [7. 全局主题色的实现机制](#7-全局主题色的实现机制)
- [8. 持久化与备份](#8-持久化与备份)
- [9. 页面结构与「我的」页要求](#9-页面结构与我的页要求)
- [10. 未证实清单](#10-未证实清单)
- [11. 相关分技能](#11-相关分技能)

---

## 1. 结论速览

| 设置项 | 取值 | 持久化 key | 官方依据 |
|---|---|---|---|
| **主题模式** | 跟随系统 / 浅色 / 深色 | `color_mode` | 系统「显示模式」为浅色/深色两卡片 |
| **材质效果** | 默认 + 5 档（共 6 个选项） | `material_style` | `ImmersiveStyle` 五档枚举 |
| **主题色** | 6 预设 + 1 自定义 HEX | `accent_color` | 设计文档定义 4 个基础色 Token |
| **默认打开** | 首页 / 书架 / 记录 / 我的 | `default_tab` | — |
| **自动播放**（同组） | 开关 | `auto_play_on_launch` | — |

> ⚠️ **「系统推荐 6 个主题色」未找到官方来源**。官方设计文档只定义
> `Primary / onPrimary / Brand / Container` **四个基础色**，加上 12 级透明度映射。
> 6 个预设色是**应用设计选择**，不是官方规范。见 [第 10 节](#10-未证实清单)。

---

## 2. 档位模型：三层要分清

沉浸光感的「档位」在不同层各有一套，**这是最容易混淆的地方**：

| 层 | 名称 | 取值 | 谁定 |
|---|---|---|---|
| **① 视觉强度** | `MaterialLevel`（HDS） | 强 `EXQUISITE` / 均衡 `GENTLE`(默认) / 弱 `SMOOTH` / 自适应 `ADAPTIVE` | 系统按设备算力 |
| **② 材质厚薄** | `ImmersiveStyle`（ArkUI） | `ULTRA_THIN` / `THIN` / `REGULAR` / `THICK` / `ULTRA_THICK` | **开发者声明** |
| **③ 应用外观选项** | 自定义编号 → `ImmersiveStyle` | 「默认」+ 5 档 = **6 个选项** | **终端用户选** |

**用户可见的是 ③**；系统设置里还有强度三档（强/均衡/弱），
但官方明确：开发侧「**无需针对用户的三档强度分别适配——系统底层自动完成参数映射**」。

**①→③ 的桥接**：应用声明的 `ImmersiveStyle` 会被系统按用户强度自动缩放。
所以应用只需提供 **①+5 档**这 6 个选项，不必处理强度。

> 完整说明见 [../immersive-material/README.md](../immersive-material/README.md)。

---

## 3. 主题模式（3 种）

### 取值与系统 API

| 选项 | 枚举值 | 含义 |
|---|---|---|
| 跟随系统 | `ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET` | 随系统深浅色 |
| 浅色模式 | `COLOR_MODE_LIGHT` | 强制浅色 |
| 深色模式 | `COLOR_MODE_DARK` | 强制深色 |

> **直接用系统枚举，不要自造数字** —— 它与 `setColorMode()` 的入参对齐。

### 切换实现

```ts
private async setColorMode(mode: number): Promise<void> {
  const ctx = this.getUIContext().getHostContext() as common.UIAbilityContext;
  const appCtx = ctx.getApplicationContext();
  try {
    appCtx.setColorMode(mode);            // ① 立即生效
  } catch (_e) { /* 系统 API 可能在无效 context 下抛错 */ }
  this.currentMode = mode;
  this.selectedThemeIndex = THEME_OPTIONS.findIndex((o) => o.mode === mode);
  await PreferenceService.setColorMode(mode);   // ② 落盘，供冷启动恢复

  // ③ 延迟更新状态栏 —— 让主题切换完成后再应用字色
  setTimeout(() => { WindowUtils.updateColorMode(mode); }, 100);
}
```
出处：`SettingsPage.ets:242-257`

> **`setTimeout(100)` 是必要的**：`setColorMode` 触发全量重绘，同步改状态栏字色
> 会读到旧主题。源码注释明确说明了这一点。

### 冷启动恢复

```ts
// EntryAbility.onCreate 里先归零，避免沿用上次进程的模式
this.context.getApplicationContext().setColorMode(
  ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET);

// 异步恢复
private async restoreColorMode(): Promise<void> {
  const mode = await PreferenceService.getColorMode();
  if (mode !== ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET) {
    this.context.getApplicationContext().setColorMode(mode);
  }
}
```
出处：`EntryAbility.ets:54-61, 416-425`

### 系统深浅色变化的响应

```ts
onConfigurationUpdate(newConfig: Configuration): void {
  if (newConfig.colorMode !== undefined) {
    WindowUtils.updateColorMode(newConfig.colorMode);   // 同步状态栏字色
  }
}
```
出处：`EntryAbility.ets:479-483`

### UI：用系统 `Select`，不用抽屉

```ts
Select(THEME_OPTIONS.map((o): SelectOption => { return { value: o.label }; }))
  .selected(this.selectedThemeIndex)
  .value(THEME_OPTIONS[this.selectedThemeIndex]?.label ?? '跟随系统')
  .font({ size: AppFont.Body })
  .fontColor($r('sys.color.font_secondary'))
  .backgroundColor(Color.Transparent)
  .onSelect((index: number) => { this.setColorMode(THEME_OPTIONS[index].mode); })
```
出处：`SettingsPage.ets:396-404`

> 主题模式**用系统 `Select` 下拉**；材质效果与主题色**用 `bindSheet` 抽屉**。

---

## 4. 材质效果（6 个选项）

### 选项表

| 编号 | 标签 | 映射到 `ImmersiveStyle` |
|---|---|---|
| **0** | **默认** | **不覆盖**，各控件用自己的推荐档位 |
| 1 | 超薄 · 通透 | `ULTRA_THIN` |
| 2 | 轻薄 · 磨砂 | `THIN` |
| 3 | 标准 | `REGULAR` |
| 4 | 厚磨砂 | `THICK` |
| 5 | 超厚磨砂 | `ULTRA_THICK` |

> **「默认」档的语义**：不覆盖，让每个控件用它自己传入的 `fallback`。
> 这是官方推荐的默认行为（导航类用薄、弹窗类用厚）。

```ts
private static resolveStyle(fallback: uiMaterial.ImmersiveStyle): uiMaterial.ImmersiveStyle {
  switch (AppAppearance.current.material) {
    case 1: return uiMaterial.ImmersiveStyle.ULTRA_THIN;
    case 2: return uiMaterial.ImmersiveStyle.THIN;
    case 3: return uiMaterial.ImmersiveStyle.REGULAR;
    case 4: return uiMaterial.ImmersiveStyle.THICK;
    case 5: return uiMaterial.ImmersiveStyle.ULTRA_THICK;
    default: return fallback;     // ← 0 = 默认 = 保留控件推荐值
  }
}
```
出处：`Theme.ets:59-68`

### 归一化（所有写入口都过这一层）

```ts
static normalizeMaterial(value: number): number {
  return Number.isInteger(value) && value >= 0 && value <= 5 ? value : 0;
}
```
出处：`AppAppearance.ets:18-20`

> 用 `Number.isInteger` 一次挡掉 `NaN` / `undefined` / 浮点 / 越界。

### 固定档位的例外

**阅读页的弹层与底栏不跟随此设置**（`fixedStyle = true`）：

| 材质 | 档位 | 原因 |
|---|---|---|
| `ReaderSheetThick` | 固定 `THICK` | 「避免正文透出干扰设置项」 |
| `ReaderBar` | 固定 `THIN` | 同官方浮动页签视觉 |

出处：`Theme.ets:117-125`（源码注释明确写了「不跟随外观厚度选项」）

### UI：`bindSheet` 抽屉 + 自绘选中态

```ts
Column({ space: AppSpace.Xs }) {
  Text('调整浮动控件与弹窗的通透程度，选择后立即生效。默认使用各控件的推荐材质。')
    .fontSize(AppFont.Caption).fontColor($r('sys.color.font_secondary'))
  ForEach(MATERIAL_CHOICES, (choice: MaterialChoice) => {
    Row() {
      Text(choice.label)
        .fontSize(AppFont.BodyL)
        .fontColor(this.appearance.material === choice.value ? AppColor.Brand : $r('sys.color.font_primary'))
        .layoutWeight(1)
      if (this.appearance.material === choice.value) {
        SymbolGlyph($r('sys.symbol.checkmark')).fontSize(20).fontColor([AppColor.Brand])
      }
    }
    .width('100%')
    .padding(AppSpace.Sm)
    .constraintSize({ minHeight: 48 })          // ← 满足热区要求
    .borderRadius(AppRadius.Md)
    .backgroundColor(this.appearance.material === choice.value ? AppColor.BrandSoft : Color.Transparent)
    .enabled(!this.saving)
    .onClick(() => this.applyMaterial(choice.value))
  }, (choice: MaterialChoice) => choice.value.toString())
}
```
出处：`AppearanceSettingsComponent.ets:94-123`

> **自绘选中态**（文字变主题色 + 右侧对勾 + `BrandSoft` 底色），
> **不用 `Radio` / `Checkbox`**。行高 ≥48 满足官方热区推荐值。

---

## 5. 主题色（6 预设 + 1 自定义）

### 预设色值（精确）

| 索引 | 色值 | 标签 | 说明 |
|---|---|---|---|
| 0 | **`''`（空串）** | 默认橙 | 哨兵值 → 解析为 `$r('app.color.app_brand')` |
| 1 | `#C4475B` | 玫瑰红 | |
| 2 | `#8E55B8` | 鸢尾紫 | 也是输入框 placeholder 示例 |
| 3 | `#2869B8` | 晴空蓝 | |
| 4 | `#008577` | 青绿色 | |
| 5 | `#557C36` | 苔藓绿 | |

> 默认橙的实际色值：浅色 `#FF6B3D` / 深色 `#FF8A5A`（`resources/{base,dark}/element/color.json`）。

**为什么「默认橙」用空串**：空串让颜色**随深浅模式自动切换**资源值，
而硬编码 `#FF6B3D` 在深色模式下对比度不足。

### 自定义 HEX 输入

| 项 | 实现 |
|---|---|
| 组件 | `TextInput` + 「应用」`Button` |
| 长度限制 | `.maxLength(7)`（恰好 `#RRGGBB`） |
| 提交方式 | 软键盘回车 `.onSubmit()` + 按钮 `.onClick()`，**两条路都调 `applyCustomAccent()`** |
| 校验正则 | `/^#[0-9A-F]{6}$/`（先 `trim()` + `toUpperCase()`） |
| 错误提示 | 条件渲染一行「请输入 # 加六位十六进制色值」 |
| 错误清除 | `onChange` 里立刻清 `colorInvalid = false` |

```ts
static normalizeAccent(value: string): string {
  const hex: string = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(hex) ? hex : '';   // 非法 → 空串（= 回默认橙）
}
```
出处：`AppAppearance.ets:22-25`

**校验边界**（复刻必知）：

| 输入 | 结果 |
|---|---|
| `#ABC` 缩写 | ✗ 拒绝 |
| `#AABBCCDD` 8 位 | ✗ 拒绝 |
| 无 `#` | ✗ 拒绝 |
| `#aabbcc` 小写 | ✓ 接受（转大写） |
| `" #AABBCC "` 带空格 | ✓ 接受（trim） |

> **非法输入静默回退默认橙**（`normalize` 返回 `''`），UI 层才显示错误提示。

### UI：色块网格 + 选中对勾

```ts
Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
  ForEach(ACCENT_CHOICES, (choice: AccentChoice) => {
    Column({ space: AppSpace.Xs }) {
      Stack() {
        Row().width(42).height(42).borderRadius(21)
          .backgroundColor(choice.color || '#FF6B3D')
        if (this.appearance.accent === choice.color) {
          SymbolGlyph($r('sys.symbol.checkmark'))
            .fontSize(20)
            // 按底色亮度自动选黑/白对勾 —— 保证任何色上都可读
            .fontColor([AppAppearance.foreground(choice.color || '#FF6B3D')])
        }
      }
      Text(choice.label).fontSize(AppFont.Caption)
    }
    .width('30%')                       // ← 每行 3 个，6 个刚好 2 行
    .padding({ top: AppSpace.Xs, bottom: AppSpace.Sm })
    .onClick(() => this.applyAccent(choice.color))
  })
}
```
出处：`AppearanceSettingsComponent.ets:132-150`

**前景色算法**（ITU-R BT.601 感知亮度）：

```ts
static foreground(hex: string): string {
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 165 ? '#191919' : '#FFFFFF';
}
```
出处：`AppAppearance.ets:35-40`

> 阈值 **165** 偏高，即「只有很亮的颜色才配黑字」，保证白字为主。

---

## 6. 启动分组（默认打开）

### 必含项

| 设置项 | 取值 | key | 默认 |
|---|---|---|---|
| **默认打开** | 首页 / 书架 / 记录 / 我的 | `default_tab` | `0`（首页） |
| 打开软件自动播放 | 开关 | `auto_play_on_launch` | `false` |

> 用户明确要求：「**启动分组切记要有默认打开**」。

### 默认打开的实现

```ts
private async restoreDefaultTab(): Promise<void> {
  const idx = await PreferenceService.getDefaultTab();
  if (idx <= 0 || idx > 3) return;    // ← 0 = 首页 = 初始态，无需切换
  setTimeout(() => {
    this.changeTab(idx);               // 等 HdsTabs 的 controller 挂载完成
  }, 50);
}

private changeTab(index: number): void {
  if (index < 0 || index > 3 || index === this.currentTab) return;
  this.tabController.changeIndex(index);   // 走原生切换
}
```
出处：`MainPage.ets:199-213`

**两个关键细节**：

1. **`idx <= 0` 提前 return** —— 默认值 0（首页）本就是初始态，
   发切换动作会多一次无意义的 Tab 动画。
2. **`setTimeout(50)`** —— 等 `HdsTabs` 的 `tabController` 完成挂载，
   否则 `changeIndex` 无效。

**Tab 顺序必须与索引一致**：`首页(0) / 书架(1) / 记录(2) / 我的(3)`。

### 读取时的范围校验

```ts
static async getDefaultTab(): Promise<number> {
  const s = await PreferenceService.ensureStore();
  const idx = await s.get(KEY_DEFAULT_TAB, 0) as number;
  if (idx < 0 || idx > 3) return 0;      // 脏数据兜底
  return idx;
}
```
出处：`PreferenceService.ets:580-585`

---

## 7. 全局主题色的实现机制

**这是「改一个色 → 全 App 六个 token 一起变」的核心。**

### 六个派生 token

```ts
export class AppColor {
  static get Brand(): ResourceStr {
    const accent = AppAppearance.current.accent;
    return accent.length > 0 ? accent : $r('app.color.app_brand');
  }
  static get BrandHover(): ResourceStr {      // 悬停
    const accent = AppAppearance.current.accent;
    return accent.length > 0 ? AppAppearance.shade(accent, 0.92) : $r('app.color.app_brand_hover');
  }
  static get BrandPressed(): ResourceStr {    // 按下（更深）
    // shade(accent, 0.82) 或 app_brand_pressed
  }
  static get BrandDisabled(): ResourceStr {   // 禁用（66 = 40% alpha）
    return accent.length > 0 ? '#66' + accent.substring(1) : $r('app.color.app_brand_disabled');
  }
  static get BrandSoft(): ResourceStr {       // 柔和底（22 = 13% alpha）
    return accent.length > 0 ? '#22' + accent.substring(1) : $r('app.color.app_brand_soft');
  }
  static get BrandDark(): ResourceStr {       // 深色变体
    // shade(accent, 0.78) 或 app_brand_dark
  }
  static get OnBrand(): ResourceStr {         // 品牌色上的前景
    return accent.length > 0 ? AppAppearance.foreground(accent) : $r('app.color.app_on_brand');
  }
}
```
出处：`Theme.ets:6-34`

**派生手段**：
- **缩放**：`shade(hex, k)` 逐通道乘系数
- **加 alpha**：`'#66' + accent.substring(1)`（40%）、`'#22' + ...`（13%）
- **亮度选色**：`foreground()` 按 BT.601 选黑/白

> ⚠️ **全部用 `static get`（不是 `readonly`）** —— 每次读都能拿到最新 accent。
> 若写成 `readonly` 缓存，换色后不生效。

### 两个易漏的坑

**坑 1：V2 依赖登记**

```ts
// 即使缓存命中也要读一次响应式 token，
// 否则 V2 不会把该组件登记为 accent 的依赖者，换色后已挂载控件不刷新。
const lightColor: ResourceColor = AppColor.Brand;
const cached = AppMaterial.cache.get(key);
if (cached !== undefined) return cached;
```
出处：`Theme.ets:78-81`（源码注释原文）

**坑 2：材质缓存键必须含 accent**

```ts
const appearanceKey: string = AppAppearance.current.material.toString()
  + ':' + AppAppearance.current.accent;
if (appearanceKey !== AppMaterial.appearanceKey) {
  AppMaterial.cache.clear();     // 档位或主题色变了，整表失效
  AppMaterial.appearanceKey = appearanceKey;
}
```
出处：`Theme.ets:73-77`

> 缓存键漏掉 accent → 改色后材质的 `lightEffect` 不更新。

---

## 8. 持久化与备份

### 存储位置

**全部落在同一个 preferences store**（`listenbook_prefs`），没有独立 store：

| key | 类型 | 默认 | 校验 |
|---|---|---|---|
| `color_mode` | number | `COLOR_MODE_NOT_SET` | 无（系统枚举直存） |
| `material_style` | number | `0` | `Number.isInteger && 0..5` |
| `accent_color` | string | `''` | `/^#[0-9A-F]{6}$/` after trim+upper |
| `default_tab` | number | `0` | 读取时 `0..3` |
| `auto_play_on_launch` | boolean | `false` | `=== true` |

### 冷启动注水（关键时序）

```ts
static async init(context: common.BaseContext): Promise<void> {
  if (PreferenceService.store) return;                 // 幂等短路
  if (!PreferenceService.initPromise) {
    PreferenceService.initPromise = preferences.getPreferences(context, { name: STORE_NAME })
      .then(async (s) => {
        PreferenceService.store = s;
        const material = await s.get(KEY_MATERIAL_STYLE, 0);
        const accent = await s.get(KEY_ACCENT_COLOR, '');
        // ↓ 在 init 阶段就注入内存单例，早于任何页面渲染
        AppAppearance.current.material = AppAppearance.normalizeMaterial(
          typeof material === 'number' ? material : 0);
        AppAppearance.current.accent = AppAppearance.normalizeAccent(
          typeof accent === 'string' ? accent : '');
      });
  }
  await PreferenceService.initPromise;
}
```
出处：`PreferenceService.ets:179-194`

> **这是「冷启动第一帧就是用户选的颜色/材质」的保证。**
> `typeof` 双重校验防的是老版本写进去的**类型漂移**脏数据。

### 写盘模式（统一三段式）

```ts
static async setMaterialStyle(value: number): Promise<void> {
  const material = AppAppearance.normalizeMaterial(value);   // ① 归一化
  const s = await PreferenceService.ensureStore();
  await s.put(KEY_MATERIAL_STYLE, material);                 // ② 落盘
  await s.flush();                                           // ③ 显式 flush
  AppAppearance.current.material = material;                 // ④ 更新内存单例
}
```
出处：`PreferenceService.ets:553-559`

> **`flush()` 不能省** —— 否则进程被杀会丢数据。

### 备份/恢复的兜底

```ts
// 恢复时：?? 默认值 + normalize 双重兜底 → 旧备份包缺字段也能安全导入
const material = AppAppearance.normalizeMaterial(snapshot.materialStyle ?? 0);
const accent = AppAppearance.normalizeAccent(snapshot.accentColor ?? '');
await s.put(KEY_MATERIAL_STYLE, material);
await s.put(KEY_ACCENT_COLOR, accent);
// ... 恢复后同步写内存单例
AppAppearance.current.material = material;
AppAppearance.current.accent = accent;
```
出处：`PreferenceService.ets:944-957`

### 防抖闸

材质与主题色共用一把 `saving` 锁，防止连点导致写盘乱序：

```ts
private async applyMaterial(value: number): Promise<void> {
  if (this.saving) return;
  this.saving = true;
  try { await PreferenceService.setMaterialStyle(value); }
  catch (_e) { this.showSaveError(); }
  finally { this.saving = false; }
}
```
出处：`AppearanceSettingsComponent.ets:51-61`

> 写盘失败**不回滚 UI** —— 因为 UI 真值来自 `AppAppearance`（写盘成功才改），
> 失败时 UI 自然不变，无需手工回滚。

---

## 9. 页面结构与「我的」页要求

### 设置页三大分组（顺序固定）

```
设置
├── 外观          ← 主题模式（Select） + 材质效果（Sheet） + 主题色（Sheet）
├── 启动          ← 默认打开（Select） + 打开软件自动播放（Switch）
└── 播放          ← 焦点模式 / 自动恢复 / 预加载章数
```
出处：`SettingsPage.ets:310-341`

**「外观」卡片的结构**（`SettingsPage.ets:381-423`）：

```
Column
├── 分组标题「外观」
└── 卡片 Column（comp_background_primary + AppRadius.Lg）
    ├── Row：主题模式（左文字 + 右 Select）   ← 内联，不用抽屉
    ├── Divider
    └── AppearanceSettingsComponent
        ├── Row：材质效果（左文字 + 右当前值 + chevron）  → bindSheet
        ├── Divider
        └── Row：主题色（左文字 + 右色点 + 当前值 + chevron） → bindSheet
```

**通用行参数**：
```ts
.width('100%')
.padding({ left: AppSpace.Md, right: AppSpace.Xs, top: AppSpace.Sm, bottom: AppSpace.Sm })
.constraintSize({ minHeight: 56 })      // 满足热区
```

### 用户明确要求的「我的」页结构

> 「我的页面，然后设置同级必须得有使用说明和关于」

```ts
const SYSTEM_ITEMS: ProfileItem[] = [
  new ProfileItem($r('sys.symbol.gearshape'), '设置', 'settings', '#8E8E93'),
  new ProfileItem($r('sys.symbol.questionmark_circle'), '使用说明', 'guide', '#5AC8FA'),
  new ProfileItem($r('sys.symbol.info_circle'), '关于', 'about', '#0A59F7'),
  new ProfileItem($r('sys.symbol.person_2'), '交流群', 'community', AppColor.Brand, ...),
];
```
出处：`ProfilePage.ets:32-38`

**顺序：设置 → 使用说明 → 关于 → 交流群**，同属一个数组、同一分组卡片、**同级关系**。

行渲染规格：

```ts
Row({ space: AppSpace.Sm }) {
  Stack() {
    SymbolGlyph(item.icon).fontSize(18).fontColor([Color.White])
  }
  .width(28).height(28)                 // 图标底
  .backgroundColor(item.iconBg)
  .borderRadius(7)

  Text(item.label).fontSize(AppFont.BodyL).layoutWeight(1)
  // 可选 trailing
  SymbolGlyph($r('sys.symbol.chevron_right')).fontSize(24)
}
.constraintSize({ minHeight: 56 })
.padding({ left: AppSpace.Md, right: AppSpace.Md, top: AppSpace.Sm, bottom: AppSpace.Sm })
```
分隔线左缩进 `16 + 28 + 12 = 56`，**精确对齐文字左边缘**（`ProfilePage.ets:376-381`）。

---

## 10. 未证实清单

| # | 条目 | 状态 |
|---|---|---|
| 1 | 「系统推荐 **6 个**主题色」 | ❌ **未找到官方来源**。设计文档只定义 4 个基础色 + 12 级透明度。6 个是应用设计选择 |
| 2 | 系统设置里「跟随系统/浅色/深色」**三选项** | ⚠️ 系统「显示模式」实为浅色/深色**两卡片**；三选项仅见于**部分应用内**（如浏览器） |
| 3 | 设置页中三项**并排**的官方排布 | ⚠️ 官方帮助页只描述「沉浸光感」单项（强/均衡/弱）。本页的三项分组是**应用设计** |
| 4 | 材质档位中文名「超薄通透 / 超薄磨砂」等 | ⚠️ 官方是「超薄样式 / 薄样式 / 常规样式 / 厚样式 / 超厚样式」，**官方文档无「磨砂」一词** |
| 5 | `setTimeout(100)` 这个具体毫秒数 | 项目经验值（源码注释说明动机，但未给依据） |
| 6 | `setTimeout(50)` 等 `tabController` 挂载 | 项目经验值 |
| 7 | 自定义色 `#RRGGBB` 的位数要求 | 项目约定；官方 `CustomColors` 未限定格式 |

---

## 11. 相关分技能

- 材质档位与 API 细节 → [../immersive-material/README.md](../immersive-material/README.md)
- 自定义背景图主题 → [background-image.md](background-image.md)
- 半模态抽屉的完整写法 → [../components/sheet.md](../components/sheet.md)
- 官方设计规范数值（色彩/对比度/热区） → [../design-specs.md](../design-specs.md)
