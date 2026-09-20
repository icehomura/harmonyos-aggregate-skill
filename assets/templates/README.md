# 工程模板

两个起点，按需取用。

## `base/` —— 官方标准骨架

来自 **DevEco Studio 官方工程模板**（`@deveco/deveco-cli` 内置），25 个文件，可直接
`deveco create` 或手动复制后构建。是所有鸿蒙工程的基线。

```
base/
├── AppScope/                       应用级配置与资源（bundleName、版本、图标）
├── entry/                          主模块
│   ├── src/main/
│   │   ├── ets/entryability/       UIAbility（应用入口）
│   │   ├── ets/entrybackupability/ 系统备份扩展
│   │   ├── ets/pages/Index.ets     入口页
│   │   ├── module.json5            模块清单
│   │   └── resources/              资源（含深浅色两套）
│   ├── build-profile.json5         模块构建配置
│   └── hvigorfile.ts
├── build-profile.json5             工程构建配置（签名、SDK 版本、产品）
├── oh-package.json5                依赖清单
└── hvigor/                         构建工具链配置
```

**官方模板的 SDK 基线是 `6.0.2(22)`**。做沉浸光感需要把 `targetSdkVersion`
提到 `26.0.0`（见下）。

### 用官方模板的标准写法

```json5
// build-profile.json5 → app.products[]
{
  "name": "default",
  "signingConfig": "default",     // 签名留空 []，由 DevEco 首次打开时生成
  "bundleName": "com.example.myapp",
  "targetSdkVersion": "26.0.0",   // ← 沉浸光感要求 ≥ 26
  "compatibleSdkVersion": "6.0.0(20)",
  "runtimeOS": "HarmonyOS",
  "buildOption": {
    "strictMode": {
      "caseSensitiveCheck": true,
      "useNormalizedOHMUrl": true
    }
  }
}
```

> SDK 版本有两种合法写法：**双段式** `"6.0.0(20)"`（推荐，语义自明）与
> **单段式** `"26.0.0"`。不要在同一工程内混用。

## `immersive/` —— 沉浸光感改造件

从 `base/` 出发做沉浸光感应用时，需要额外补的三个文件。复制到对应路径即可。

| 文件 | 目标路径 | 作用 |
|---|---|---|
| `PlatformCompat.ets` | `entry/src/main/ets/utils/` | **API 能力分流**。用 `deviceInfo.sdkApiVersion` 判断设备实际能力 |
| `AppAppearance.ets` | `entry/src/main/ets/model/` | **全局外观状态**（材质档位 + 主题色），V2 响应式单例 |
| `AppMaterial.ets` | `entry/src/main/ets/theme/` | **材质统一入口**。含缓存、版本分流、磨砂回退 |

### 必做的 4 处改造

**① 开启应用级沉浸光感**（`entry/src/main/module.json5`）：

```json5
{
  "module": {
    "metadata": [
      { "name": "ohos.arkui.UIMaterial.state", "value": "enable" }
    ]
  }
}
```

> `value` 可选 `default` / `enable` / `disable`。
> 该配置**仅在 `type: "entry"` 的模块中生效**。

**② 引入三个文件**，路径见上表。

**③ 在组件上使用材质**（注意顺序 —— 材质必须放在其他样式之后）：

```ts
Row() {
  SymbolGlyph($r('sys.symbol.magnifyingglass')).fontSize(17)
  Text('搜索').layoutWeight(1)
}
.layoutWeight(1)
.height(40)
.padding({ left: 12, right: 12 })
.borderRadius(999)
.backgroundColor(Color.Transparent)                              // ← 不能是实色
.attributeModifier(AppMaterial.modifier(AppMaterial.InteractiveClean))
```

**④ 补回退色资源**（`resources/base/element/color.json` + `resources/dark/...`）：

```json
{
  "color": [
    { "name": "app_brand", "value": "#FF6B3D" },
    { "name": "glass_control_fallback", "value": "#E6FFFFFF" },
    { "name": "glass_sheet_fallback", "value": "#F2171A1D" }
  ]
}
```

深色版对应改为 `#FF8A5A` / `#D12C2C2C` / `#F2171A1D`。

## 沉浸光感的必守规则

复制模板后，这些约束仍然适用（违反会导致材质失效或视觉异常）：

1. **`systemMaterial` 必须放在其他样式属性之后**
2. 设材质后**不得再设** `backgroundColor` / `backgroundBlurStyle` / 边框
3. **生效范围**：普通容器只在 Navigation 标题栏 / `barPosition: End` 的底部 TabBar
   中生效；其余仅弹窗类 / Slider / Toggle / Select 全页面生效
4. **同一子树只设一次材质**，禁止嵌套
5. **材质自带模糊**，不要再叠 `backgroundBlurStyle`
6. 构建失败先查 `superset 顺序` 与 `import` 路径，再查 API 版本守卫

完整说明见 [`references/immersive-material/`](../../references/immersive-material/)。

## 相关文档

- 工程架构与路由 → [`references/project-architecture/`](../../references/project-architecture/)
- 材质体系 → [`references/immersive-material/`](../../references/immersive-material/)
- 设计规范数值 → [`references/design-specs.md`](../../references/design-specs.md)
