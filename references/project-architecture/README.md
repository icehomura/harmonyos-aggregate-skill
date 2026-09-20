# 工程架构（Project Architecture）

> **用途**：从零搭一个 HarmonyOS **Stage 模型 + 单模块 entry + ArkUI V2** 的沉浸光感应用，
> 或对既有工程做架构评审。本文给出**目录分层约定、每个配置文件的原文、路由方案、
> Service 单例模板、V2 状态管理约定与构建命令**。
>
> **证据约定**：
> - `entry/src/main/ets/...:行号` —— 指向真实工程
>   `C:\Users\icehomura\workspace\arkts\HarmonyOS-book`（应用「简听 / listenbook」），
>   行号为撰写时实测值。
> - `references/huawei-docs/...` —— 本技能包内的官方文档本地副本。
> - **官方未表述而仅来自本工程实践的结论，显式标注「未证实」。**
>
> ⚠️ **版本基线存在不一致，先读 [§1](#1-技术栈与版本基线含不一致说明) 再动手。**

## 目录

- [1. 技术栈与版本基线（含不一致说明）](#1-技术栈与版本基线含不一致说明)
- [2. 目录分层约定](#2-目录分层约定)
- [3. 最小文件清单](#3-最小文件清单)
- [4. 配置文件全文](#4-配置文件全文)
- [5. 构建配置关键项](#5-构建配置关键项)
- [6. 路由：main_pages.json + Navigation](#6-路由main_pagesjson--navigation)
- [7. 路由表（Index.ets routerMap）](#7-路由表indexets-routermap)
- [8. Service 单例标准模板](#8-service-单例标准模板)
- [9. ArkUI V2 状态管理约定](#9-arkui-v2-状态管理约定)
- [10. 构建与运行命令](#10-构建与运行命令)
- [11. 反模式](#11-反模式)
- [12. 官方出处速查](#12-官方出处速查)
- [13. 相关分技能](#13-相关分技能)

---

## 1. 技术栈与版本基线（含不一致说明）

| 项 | 值 | 出处 |
|---|---|---|
| 应用名 / bundleName | 简听 / `com.huan.listenbook` | `oh-package.json5:3-5`、`AppScope/app.json5:3` |
| 模型 | **Stage 模型** | `entry/build-profile.json5:2` `"apiType": "stageMode"` |
| 模块结构 | **单模块** `entry` | 根 `build-profile.json5:57-71` |
| 设备类型 | **phone only** | `entry/src/main/module.json5:7-9` |
| 状态管理 | **ArkUI V2** | `README.md`（「App 使用 ArkUI V2 状态管理」） |
| ArkTS 运行时 | QuickJS HAR（受限双 ABI） | `entry/oh-package.json5` `@devzeng/quickjs: file:./libs/quickjs.har` |
| 版本号 | versionCode `1000025` / versionName `0.1.25` | `AppScope/app.json5:5-6` |

### 1.1 ⚠️ 版本基线的真实不一致

**同一套材料里，四个地方写了三套不同的 SDK 版本**，必须如实说明：

| 位置 | `compatibleSdkVersion` | `targetSdkVersion` |
|---|---|---|
| **本仓库 `build-profile.json5`（实际生效，本机版）** | **`"26.0.0"`**（`:24`、`:38`） | **`"26.0.0"`**（`:23`、`:37`） |
| 本仓库 `build-profile.template.json5`（可提交模板） | `"6.0.0(20)"`（`:10`、`:23`） | `"6.1.1(24)"`（`:9`、`:22`） |
| 本仓库 `AGENTS.md` / `README.md`（文档声明） | `6.0.0(20)` | `6.1.1(24)` |
| **本技能包** `skill.yaml` / `SKILL.md` | `"6.0.0(20)"` | **`"26.0.0"`** |

- 文档原文（`AGENTS.md:151`）：
  > **SDK**: HarmonyOS 6.0+; `targetSdkVersion = 6.1.1(24)`, `compatibleSdkVersion = 6.0.0(20)`
  > for both App products and the QuickJS HAR; `bundleName: com.huan.listenbook`.
  > Build with a verified Release SDK; Beta/Canary artifacts must not be published.

- `README.md`（开发与验证章节）：
  > 新环境可先用 `build-profile.template.json5`（源工程文件，见证据约定） 创建本机
  > `build-profile.json5`，再配置签名；**模板保留最低 API 20 与目标 API 24**，不包含签名材料。

- 本技能包 `skill.yaml:14-15`：
  > ```yaml
  > apiBaseline:
  >   compatible: "6.0.0(20)"   # 最低 API 20
  >   target: "26.0.0"          # 目标 API 26（沉浸光感正式版）
  > ```

**结论**：

1. **本仓库可提交的基线是 `compatibleSdkVersion = 6.0.0(20)` / `targetSdkVersion = 6.1.1(24)`** ——
   以 `build-profile.template.json5` + `AGENTS.md` + `README.md` 三方一致为准。
   **最低 API 20 这一点四处完全一致，无争议。**
2. **`targetSdkVersion` 有分歧**：仓库文档写 **24**，本机 `build-profile.json5` 写 **26**，
   本技能包写 **26**。三者不可同时为真。
   - 技能包选 26 的理由可推断：`uiMaterial` 沉浸光感与 `TYPE_FLOAT_NAVIGATION` 都是 API 26 才有
     （`skill.yaml:17` 注释、`references/immersive-material/README.md`）。
   - **仓库文档写 24 与技能包写 26 哪个是本意 —— 未证实。**
3. 仓库里那份 `build-profile.json5` 是**本机文件**，被改成了 `"26.0.0"` 并且**内嵌了签名材料**
   （`:8-14`，含 `keyPassword` / `storePassword`）。按项目自己的约定
   （`README.md`「不要提交证书、口令或 `build-profile.json5` 的本机改动」），它**不应被复制或提交**。
4. **为什么本机文件会变成 `"26.0.0"` —— 未证实。** 可能是本机 DevEco Studio 自动升级、也可能是
   为了在本机调试 API 26 的 `uiMaterial` / `TYPE_FLOAT_NAVIGATION` 而临时抬高。
   仓库中未见任何提交信息或注释解释这一点。

> ⚠️ **搭新工程时的取舍**：
> - 若目标设备含 API 20–25 的存量机型 → `compatibleSdkVersion = "6.0.0(20)"`，
>   `targetSdkVersion` 按你要不要用 API 26 的 `uiMaterial` 决定（要就用 `"6.1.1(24)"` 起步，
>   API 26 能力用 `PlatformCompat` 运行时分流 —— `entry/src/main/ets/utils/PlatformCompat.ets:4-7`）。
> - **不要照抄 `build-profile.json5` 的 `"26.0.0"`**，那会把 `compatibleSdkVersion` 一起抬到 26，
>   API 20–25 设备直接装不上。

---

## 2. 目录分层约定

### 2.1 分层（`entry/src/main/ets/` 下，实测文件数）

| 目录 | 文件数 | 职责 | 命名规则 |
|---|---|---|---|
| `pages/` | 29 | 路由页。每个文件导出一个 `@ComponentV2 struct XxxPage` | **`XxxPage`** |
| `components/` | 22 | 可复用 UI 单元（卡片、轮播、骨架屏、弹层内容） | **`XxxComponent`** 或语义名（`MiniPlayer`、`GlassSurface`） |
| `service/` | 108 | 业务/数据/系统能力封装。**无 UI** | **`XxxService`**（工具型可 `XxxStore`/`XxxPolicy`/`XxxRunner`） |
| `model/` | 12 | 纯数据模型 + `@ObservedV2` 可观测状态 | 语义名（`Book`、`PlayerState`、`AppAppearance`） |
| `theme/` | 1 | 设计 token 唯一来源 | 固定 `Theme.ets` |
| `utils/` | 17 | 无状态工具、兼容层、协调器 | 语义名（`WindowUtils`、`PlatformCompat`、`HdsCompat`） |
| `widget/` | 2 | 卡片（form）进程代码，**独立于主进程** | `XxxFormAbility` / `pages/XxxCard` |
| `entryability/` | 1 | UIAbility 入口 | `EntryAbility.ets` |
| `entrybackupability/` | 1 | 备份 ExtensionAbility | `EntryBackupAbility.ets` |

`service/` 按域再分一层子目录（共 108 个 `.ets`）：

| 子目录 | 文件数 | 域 |
|---|---|---|
| `service/`（根） | 30 | 通用服务（音频、下载、偏好、统计、续播…） |
| `service/rulesource/` | 55 | 书源规则引擎（最大的一块） |
| `service/text/` | 11 | 文本朗读（TTS） |
| `service/builtin/` | 10 | 内置书源适配器 |
| `service/http/` | 2 | HTTP 客户端与预连接 |

### 2.2 命名规则（官方 vs 工程）

工程约定原文（`AGENTS.md:150`）：

> **Naming**: `XxxPage`, `XxxService`, `XxxComponent` (PascalCase + suffix);
> camelCase for fields/methods

配套约定：

- **Commit**：Conventional Commits（`feat:`、`fix:`、`fix(player):`、`feat(server):`…），
  中英文摘要均可（`AGENTS.md:148`）。
- **回复语言**：始终中文（`AGENTS.md:144`）。
- 文件名与导出的 struct/class 名**同名**（`HomePage.ets` → `struct HomePage`）。

> ⚠️ 工程内有**一处命名违规**：路由名 `RuleSourceEditPage` / `RuleSourceDebugPage`
> 用了 PascalCase，而其余 23 个路由名是 kebab-case（`ruleSources`、`ruleSourceAccount`…）。
> 见 `Index.ets:334, 339`。新工程应统一用 kebab-case 路由名。

### 2.3 `pages/` vs `components/` 的边界

- `pages/` 里的文件**必须是路由目的地**（在 `Index.ets` 的 `routerMap` 里出现）或宿主（`Index`）。
- `components/` 里的文件**不得**被 `routerMap` 引用。
- `service/` 里的文件**禁止** `import` ArkUI 组件（允许 `import { window }` / `AppStorageV2` 这类框架 API）。

---

## 3. 最小文件清单

Stage 模型 + 单模块 entry 的最小可运行集合（本工程实际包含的文件，✓ 为必需）：

```
HarmonyOS-book/
├── build-profile.json5            ✓ 应用级构建配置（product / signingConfigs / modules）
├── build-profile.template.json5   ○ 可提交模板（签名留空）
├── oh-package.json5               ✓ 根包描述 + devDependencies
├── oh-package-lock.json5          ✓ 依赖锁（自动生成）
├── hvigorfile.ts                  ✓ 应用级构建脚本（appTasks）
├── code-linter.json5              ✓ 静态检查规则（可缺省）
├── obfuscation-rules.txt          ○ release 混淆规则
├── AppScope/
│   ├── app.json5                  ✓ 应用信息（bundleName / versionCode / icon / label）
│   └── resources/base/…           ✓ 应用级资源（图标、字符串）
└── entry/
    ├── build-profile.json5        ✓ 模块级构建配置（apiType: stageMode / targets）
    ├── hvigorfile.ts              ✓ 模块级构建脚本（hapTasks）
    ├── oh-package.json5           ✓ 模块依赖（含 HAR）
    ├── oh-package-lock.json5      ✓
    ├── libs/quickjs.har           ○ 本地 HAR 依赖
    └── src/
        ├── main/
        │   ├── module.json5       ✓ 模块声明（abilities / pages / permissions）
        │   ├── ets/
        │   │   ├── entryability/EntryAbility.ets   ✓ UIAbility 入口
        │   │   ├── pages/Index.ets                 ✓ 唯一注册页 + Navigation 宿主
        │   │   ├── pages/…                         ○ 其余页面（运行时映射）
        │   │   ├── components/                     ○
        │   │   ├── service/                        ○
        │   │   ├── model/                          ○
        │   │   ├── theme/                          ○
        │   │   └── utils/                          ○
        │   └── resources/
        │       ├── base/element/…                  ✓ color.json / string.json / float.json
        │       ├── base/media/…                    ✓ 图标
        │       └── base/profile/
        │           ├── main_pages.json             ✓ 页面路由表（只注册 Index）
        │           ├── backup_config.json          ○ 备份 ExtensionAbility 用
        │           ├── network_config.json         ○ 网络明文/证书配置
        │           └── player_form_config.json     ○ 卡片配置
        ├── test/                                   ○ 本地单测
        ├── ohosTest/                               ○ 设备测试
        └── mock/                                   ○ mock 配置
```

---

## 4. 配置文件全文

> **复制原则**：标 ✅ 的可以整段照抄；标 ⚠️ 的已按安全原因改写，**不要照抄原文件的敏感字段**。
> 依赖/包名/版本号请改成自己的。

### 4.1 ✅ 根 `build-profile.json5`（结构）

⚠️ 原文件的 `signingConfigs[0].material` 内**含真实的 `keyPassword` / `storePassword`**
（`build-profile.json5:10,14`），此处用占位符替换。**其余字段与原文一致。**

```json5
{
  "app": {
    "signingConfigs": [
      {
        "name": "default",
        "type": "HarmonyOS",
        "material": {
          "certpath": "C:\\Users\\<you>\\.ohos\\config\\<your>.cer",
          "keyAlias": "debugKey",
          "keyPassword": "<由 DevEco Studio 生成，勿提交>",
          "profile": "C:\\Users\\<you>\\.ohos\\config\\<your>.p7b",
          "signAlg": "SHA256withECDSA",
          "storeFile": "C:\\Users\\<you>\\.ohos\\config\\<your>.p12",
          "storePassword": "<由 DevEco Studio 生成，勿提交>"
        }
      }
    ],
    "products": [
      {
        "name": "default",
        "signingConfig": "default",
        "bundleName": "com.huan.listenbook",
        "targetSdkVersion": "26.0.0",
        "compatibleSdkVersion": "26.0.0",
        "runtimeOS": "HarmonyOS",
        "buildOption": {
          "strictMode": {
            "caseSensitiveCheck": true,
            "useNormalizedOHMUrl": true
          }
        }
      },
      {
        "name": "release",
        "signingConfig": "default",
        "bundleName": "com.huan.listenbook",
        "targetSdkVersion": "26.0.0",
        "compatibleSdkVersion": "26.0.0",
        "runtimeOS": "HarmonyOS",
        "buildOption": {
          "strictMode": {
            "caseSensitiveCheck": true,
            "useNormalizedOHMUrl": true
          }
        }
      }
    ],
    "buildModeSet": [
      {
        "name": "debug",
      },
      {
        "name": "release"
      }
    ]
  },
  "modules": [
    {
      "name": "entry",
      "srcPath": "./entry",
      "targets": [
        {
          "name": "default",
          "applyToProducts": [
            "default",
            "release"
          ]
        }
      ]
    }
  ]
}
```

—— 对照 `build-profile.json5:1-72`。注意 `debug` 那一项**末尾有个多余的逗号**
（`:50`），JSON5 允许，但换 JSON 解析器会报错。

> ⚠️ **`targetSdkVersion` / `compatibleSdkVersion` 别抄 `"26.0.0"`**，见 [§1.1](#11--版本基线的真实不一致)。
> 用 `"6.1.1(24)"` / `"6.0.0(20)"`。

### 4.2 ✅ `build-profile.template.json5`（可提交版，全文）

这就是「签名留空」的标准做法 —— **`"signingConfigs": []`**：

```json5
// 公共构建配置：最低 HarmonyOS 6.0 / API 20；签名在本机 DevEco Studio 中配置。
{
  "app": {
    "signingConfigs": [],
    "products": [
      {
        "name": "default",
        "bundleName": "com.huan.listenbook",
        "targetSdkVersion": "6.1.1(24)",
        "compatibleSdkVersion": "6.0.0(20)",
        "runtimeOS": "HarmonyOS",
        "buildOption": {
          "strictMode": {
            "caseSensitiveCheck": true,
            "useNormalizedOHMUrl": true
          }
        }
      },
      {
        "name": "release",
        "bundleName": "com.huan.listenbook",
        "targetSdkVersion": "6.1.1(24)",
        "compatibleSdkVersion": "6.0.0(20)",
        "runtimeOS": "HarmonyOS",
        "buildOption": {
          "strictMode": {
            "caseSensitiveCheck": true,
            "useNormalizedOHMUrl": true
          }
        }
      }
    ],
    "buildModeSet": [
      {
        "name": "debug"
      },
      {
        "name": "release"
      }
    ]
  },
  "modules": [
    {
      "name": "entry",
      "srcPath": "./entry",
      "targets": [
        {
          "name": "default",
          "applyToProducts": [
            "default",
            "release"
          ]
        }
      ]
    }
  ]
}
```

—— 全文照抄 `build-profile.template.json5:1-57`。

### 4.3 ✅ 根 `oh-package.json5`（全文）

```json5
{
  "modelVersion": "6.1.0",
  "name": "listenbook",
  "version": "1.0.0",
  "description": "简听：面向 HarmonyOS 的音频收听与小说阅读应用",
  "dependencies": {
  },
  "devDependencies": {
    "@ohos/hypium": "1.0.25",
    "@ohos/hamock": "1.0.0"
  }
}
```

—— 全文照抄 `oh-package.json5:1-11`。

要点：**`dependencies` 为空**，运行时依赖全部下放到模块级 `entry/oh-package.json5`。
`modelVersion: "6.1.0"` 需与 DevEco 版本匹配。

### 4.4 ✅ `entry/oh-package.json5`（全文）

```json5
{
  "name": "entry",
  "version": "1.0.0",
  "description": "简听主模块",
  "main": "",
  "author": "ylwang",
  "license": "MIT",
  "dependencies": {
    "@devzeng/quickjs": "file:./libs/quickjs.har"
  }
}
```

—— 全文照抄 `entry/oh-package.json5:1-12`。

> **本地 HAR 的引用写法**：`"file:./libs/quickjs.har"`，路径相对模块根。
> 换新环境需先运行 `ohpm install` 生成 `oh_modules`。

### 4.5 ✅ 根 `hvigorfile.ts`（全文）

```ts
import { appTasks } from '@ohos/hvigor-ohos-plugin';

export default {
  system: appTasks, /* Built-in plugin of Hvigor. It cannot be modified. */
  plugins: []       /* Custom plugin to extend the functionality of Hvigor. */
}
```

—— 全文照抄 `hvigorfile.ts:1-6`。

### 4.6 ✅ `entry/build-profile.json5`（全文）

```json5
{
  "apiType": "stageMode",
  "buildOption": {
    "resOptions": {
      "copyCodeResource": {
        "enable": false
      }
    }
  },
  "buildOptionSet": [
    {
      "name": "release",
      "arkOptions": {
        "obfuscation": {
          "ruleOptions": {
            "enable": true,
            "files": [
              "../obfuscation-rules.txt"
            ]
          }
        }
      }
    },
  ],
  "targets": [
    {
      "name": "default"
    },
    {
      "name": "ohosTest",
    }
  ]
}
```

—— 全文照抄 `entry/build-profile.json5:1-33`。

### 4.7 ✅ `entry/hvigorfile.ts`（全文，含自定义插件）

这是模块级构建脚本，本工程加了一个**自定义插件**在资源编译后、HAP 打包前恢复
1024×1024 分层图标：

```ts
import { hvigor, HvigorPlugin } from '@ohos/hvigor';
import { hapTasks, OhosHapContext, OhosPluginId } from '@ohos/hvigor-ohos-plugin';
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const preserveLayeredIcon: HvigorPlugin = {
  pluginId: 'listenbook.preserve-layered-icon',
  apply(node) {
    hvigor.nodesEvaluated(() => {
      const context: OhosHapContext = node.getContext(OhosPluginId.OHOS_HAP_PLUGIN);
      context.targets(target => {
        const targetName = target.getTargetName();
        node.registerTask({
          name: `${targetName}@PreserveLayeredIcon`,
          dependencies: [`${targetName}@CompileResource`],
          postDependencies: [`${targetName}@ProcessCompiledResources`],
          run() {
            // SDK restool 的 ScaleIcons 会把分层 PNG 固定缩到 512px。
            // 在资源编译后、HAP 打包签名前保留 AGC 要求的 1024px 原图。
            // 依据：openharmony/developtools_global_resource_tool/src/compression_parser.cpp
            const sourceDir = join(context.getModulePath(), 'src/main/resources/base/media');
            const outputDir = join(target.getModulePathDetails().getIntermediatesRes(), 'resources/base/media');
            for (const layer of ['foreground', 'background']) {
              const name = `app_icon_${layer}.png`;
              const source = join(sourceDir, name);
              const png = readFileSync(source);
              if (png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024) {
                throw new Error(`${name} must be 1024x1024; run scripts/generate_app_icon.py`);
              }
              copyFileSync(source, join(outputDir, name));
            }
          }
        });
      });
    });
  }
};

export default {
  system: hapTasks, /* Built-in plugin of Hvigor. It cannot be modified. */
  plugins: [preserveLayeredIcon]
}
```

—— 全文照抄 `entry/hvigorfile.ts:1-42`。

> **新工程不需要这个插件**，除非你也要发布到 AGC 且用分层图标。

### 4.8 ✅ `entry/src/main/module.json5`（全文）

```json5
{
  "module": {
    "name": "entry",
    "type": "entry",
    "description": "$string:module_desc",
    "mainElement": "EntryAbility",
    "deviceTypes": [
      "phone"
    ],
    "deliveryWithInstall": true,
    "installationFree": false,
    "pages": "$profile:main_pages",
    // Account Kit 华为账号登录:把 AGC「应用」的 Client ID 填到这里(若 Client ID 与 APP ID 相同则可不配)
    "metadata": [
      {
        "name": "client_id",
        "value": "REPLACE_WITH_YOUR_APP_CLIENT_ID"
      }
    ],
    "requestPermissions": [
      {
        "name": "ohos.permission.INTERNET"
      },
      {
        "name": "ohos.permission.VIBRATE"
      },
      {
        "name": "ohos.permission.KEEP_BACKGROUND_RUNNING",
        "reason": "$string:keep_background_running_reason",
        "usedScene": {
          "abilities": [
            "EntryAbility"
          ],
          "when": "inuse"
        }
      }
    ],
    "abilities": [
      {
        "name": "EntryAbility",
        "srcEntry": "./ets/entryability/EntryAbility.ets",
        "description": "$string:EntryAbility_desc",
        "icon": "$media:app_icon",
        "label": "$string:EntryAbility_label",
        "launchType": "singleton",
        "continuable": true,
        "startWindowIcon": "$media:splash_text",
        "startWindowBackground": "$color:start_window_background",
        "orientation": "auto_rotation_restricted",
        "exported": true,
        "backgroundModes": [
          "dataTransfer",
          "audioPlayback"
        ],
        "skills": [
          {
            "entities": [
              "entity.system.home"
            ],
            "actions": [
              "ohos.want.action.home"
            ]
          },
          {
            // 系统“使用其他应用打开”：通过 type 匹配 JSON，并声明 FileOpen 功能。
            "actions": ["ohos.want.action.viewData"],
            "uris": [
              { "scheme": "file", "type": "general.json", "linkFeature": "FileOpen" },
              { "scheme": "file", "type": "application/json", "linkFeature": "FileOpen" },
              { "scheme": "file", "type": "text/json", "linkFeature": "FileOpen" },
              { "scheme": "content", "type": "general.json", "linkFeature": "FileOpen" },
              { "scheme": "content", "type": "application/json", "linkFeature": "FileOpen" },
              { "scheme": "content", "type": "text/json", "linkFeature": "FileOpen" }
            ]
          }
        ]
      }
    ],
    "extensionAbilities": [
      {
        "name": "EntryBackupAbility",
        "srcEntry": "./ets/entrybackupability/EntryBackupAbility.ets",
        "type": "backup",
        "exported": false,
        "metadata": [
          {
            "name": "ohos.extension.backup",
            "resource": "$profile:backup_config"
          }
        ],
      },
      {
        "name": "PlayerFormAbility",
        "srcEntry": "./ets/widget/PlayerFormAbility.ets",
        "label": "$string:PlayerFormAbility_label",
        "description": "$string:PlayerFormAbility_desc",
        "type": "form",
        "metadata": [
          {
            "name": "ohos.extension.form",
            "resource": "$profile:player_form_config"
          }
        ]
      }
    ]
  }
}
```

—— 全文照抄 `entry/src/main/module.json5:1-107`。

关键字段官方说明（`references/huawei-docs/harmonyos-guides/module-configuration-file.md`）：

| 字段 | 官方含义 | 行号 |
|---|---|---|
| `pages` | 资源配置，指向 profile 下面定义的配置文件 `main_pages.json` | `:77` |
| `srcEntry` | 标识当前 UIAbility 组件的代码路径，取值长度不超过 127 字节，**该标签不可缺省** | `:324` |

> **挖孔适配注意**：官方 `expandSafeArea` 文档指出，未添加 Metadata 配置项时页面**不避让挖孔**
> （`references/huawei-docs/harmonyos-references/ts-universal-attributes-expand-safe-area.md:82`）。
> 本工程的 `metadata` 只有 `client_id`，**没有挖孔配置项**；
> 挖孔避让走 `getWindowAvoidArea(TYPE_CUTOUT)`，见
> [immersive-material/safe-area.md](../immersive-material/safe-area.md#12-官方挖孔区适配规则ux-标准-2122)。

### 4.9 ✅ `entry/src/main/resources/base/profile/main_pages.json`（全文）

```json
{
  "src": [
    "pages/Index"
  ]
}
```

—— 全文照抄 `entry/src/main/resources/base/profile/main_pages.json:1-5`。

**只注册一个页面。** 官方对 `src` 的定义：

> `src` | 标识当前 Module 中所有页面的路由信息，包括页面路径和页面名称。
> 其中，**页面路径是以当前 Module 的 `src/main/ets` 为基准**。该标签取值为一个字符串数组，
> 其中每个元素表示一个页面。 | 字符串数组 | **该标签不可缺省**。
> —— `references/huawei-docs/harmonyos-guides/module-configuration-file.md:264`

可选的 `window` 子对象（`designWidth` 默认 720px、`autoDesignWidth` 默认 false，
`module-configuration-file.md:265, 268-270`）本工程未配置。

### 4.10 ✅ `AppScope/app.json5`（全文）

```json5
{
  "app": {
    "bundleName": "com.huan.listenbook",
    "vendor": "ylwang",
    "versionCode": 1000025,
    "versionName": "0.1.25",
    "buildVersion": "1",
    "icon": "$media:app_icon",
    "label": "$string:app_name"
  }
}
```

—— 全文照抄 `AppScope/app.json5:1-11`。

### 4.11 ✅ `code-linter.json5`（全文）

```json5
{
  "files": [
    "**/*.ets"
  ],
  "ignore": [
    "**/src/ohosTest/**/*",
    "**/src/test/**/*",
    "**/src/mock/**/*",
    "**/node_modules/**/*",
    "**/oh_modules/**/*",
    "**/build/**/*",
    "**/.preview/**/*"
  ],
  "ruleSet": [
    "plugin:@performance/recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@security/no-unsafe-aes": "error",
    "@security/no-unsafe-hash": "error",
    "@security/no-unsafe-mac": "warn",
    "@security/no-unsafe-dh": "error",
    "@security/no-unsafe-dsa": "error",
    "@security/no-unsafe-ecdsa": "error",
    "@security/no-unsafe-rsa-encrypt": "error",
    "@security/no-unsafe-rsa-sign": "error",
    "@security/no-unsafe-rsa-key": "error",
    "@security/no-unsafe-dsa-key": "error",
    "@security/no-unsafe-dh-key": "error",
    "@security/no-unsafe-3des": "error"
  }
}
```

—— 全文照抄 `code-linter.json5:1-32`。
对应 `AGENTS.md:130` 的描述：「`code-linter.json5` enforces crypto security rules … on all `.ets` files」。

---

## 5. 构建配置关键项

### 5.1 `apiType: "stageMode"`

```json5
{
  "apiType": "stageMode",
  ...
}
```
—— `entry/build-profile.json5:2`

**Stage 模型**是唯一选择（FA 模型已废弃）。它决定了：

- 入口是 `UIAbility`（`entry/src/main/ets/entryability/EntryAbility.ets`），
  生命周期 `onCreate` / `onWindowStageCreate` / `onForeground` / `onBackground` / `onDestroy`；
- 页面加载是 `windowStage.loadContent('pages/Index', cb)`（`EntryAbility.ets:469`）；
- Ability 之间用 `Want` 而非 `Intent`。

> 官方模型约束（多处出现）：`setFloatNavigationAvoidAreaEnabled()` 等新接口标注
> 「**此接口仅可在 Stage 模型下使用**」（`references/huawei-docs/harmonyos-references/arkts-apis-window-window.md:2101`）。

### 5.2 `strictMode`

两个 product 都开了同一组：

```json5
"buildOption": {
  "strictMode": {
    "caseSensitiveCheck": true,
    "useNormalizedOHMUrl": true
  }
}
```
—— `build-profile.json5:26-31`、`:40-45`；模板 `build-profile.template.json5:12-17`、`:26-31`

| 开关 | 作用（工程实践理解，**官方逐字定义未在本地文档中检索到 → 未证实**） |
|---|---|
| `caseSensitiveCheck` | 大小写敏感的文件/模块路径检查，避免在大小写不敏感的文件系统上开发、在敏感系统上构建失败 |
| `useNormalizedOHMUrl` | 使用规范化后的 OHM（OpenHarmony Module）URL 解析依赖，HAR/HSP 多包场景下避免路径歧义 |

> ⚠️ 这两项的**官方逐字说明未在本地 4 万篇文档中检索到**，标注为**未证实**。
> 可确证的是：本工程两处 product 与模板都开启了它们，且工程能正常构建。

### 5.3 签名留空的做法

**标准做法是提供一份 `signingConfigs: []` 的模板文件，并把真机签名文件排除在版本控制外。**

```json5
{
  "app": {
    "signingConfigs": [],
    ...
```
—— `build-profile.template.json5:4`

配套约定（`README.md` 开发与验证章节）：

> 使用配套正式版 SDK 的 DevEco Studio … **在本机 Signing Configs 配置签名。
> 不要提交证书、口令或 `build-profile.json5` 的本机改动。**
> 新环境可先用 `build-profile.template.json5`（源工程文件，见证据约定） 创建本机
> `build-profile.json5`，再配置签名；模板保留最低 API 20 与目标 API 24，**不包含签名材料**。

流程：

1. 把 `build-profile.template.json5` 复制为 `build-profile.json5`（新克隆的仓库里通常没有后者）；
2. 在 DevEco Studio 的 **File → Project Structure → Signing Configs** 里勾选
   「Automatically generate signature」，IDE 会自动填充 `signingConfigs[0].material`；
3. `.gitignore` 里排除 `build-profile.json5` 与证书文件。

> ⚠️ **本仓库的 `build-profile.json5:8-14` 里 `keyPassword` / `storePassword` 是明文**
> （DevEco 加密后的密文串，但仍属敏感材料）。**不要把这段复制到任何提交物里。**

---

## 6. 路由：main_pages.json + Navigation

### 6.1 方案

| 项 | 本工程做法 |
|---|---|
| `main_pages.json` 注册页面数 | **1**（只有 `pages/Index`，§4.9） |
| 其余 28 个页面 | **不注册**，用 `Navigation` + `NavPathStack` 运行时映射 |
| 映射方式 | `Index.ets` 里 `@Builder routerMap(name, param)` + `.navDestination(this.routerMap)` |
| 栈管理 | `@Local navStack: NavPathStack = new NavPathStack()`（`Index.ets:54`） |

导航宿主全文骨架（`Index.ets:398-413`）：

```ts
build() {
  Navigation(this.navStack) {
    // home 已在 aboutToAppear 中 push,根内容留空
  }
  .backgroundColor('#000000')
  .navDestination(this.routerMap)
  .customNavContentTransition((from: NavContentInfo, to: NavContentInfo,
    operation: NavigationOperation): NavigationAnimatedTransition | undefined => {
    return this.oneShotNavigationTransition(from, to, operation);
  })
  .hideTitleBar(true)
  .mode(NavigationMode.Stack)
  .width('100%')
  .height('100%')
  .id(OneShotTransitionIds.ROOT_NAVIGATION)
}
```

**栈底在 `aboutToAppear` 里先压入**，保证栈永不为空（`Index.ets:67-69`）：

```ts
aboutToAppear(): void {
  // 先 push home 作为栈底,再消费 widget 路由,保证栈不空
  this.navStack.pushPathByName('home', null, false);
  ...
}
```

### 6.2 跳转 API

| 动作 | 写法 | 工程示例 |
|---|---|---|
| 压栈 | `navStack.pushPathByName(name, param, animated)` | `Index.ets:69`、`:130` |
| 出栈 | `navStack.pop(animated)` | `Index.ets:243` |
| 取当前栈 | `navStack.getAllPathName()` | `Index.ets:127` |
| 根页返回拦截 | `NavDestination().onBackPressed(() => {...})` | `Index.ets:177`、`:239` |
| 路由页生命周期 | `.onShown()` / `.onHidden()` | `Index.ets:291-292` |

### 6.3 官方替代方案：系统路由表

官方还支持**系统路由表**（`router_map.json` + `module.json5` 里
`"routerMap": "$profile:router_map"`），由系统按名字查找页面，无需在宿主里写
`@Builder`。官方原文：

> 使用 Navigation 时，需要手动添加系统路由表文件 `src/main/resources/base/profile/router_map.json`，
> 并在 `module.json5` 中添加 `"routerMap": "$profile:router_map"`。
> —— `references/huawei-docs/harmonyos-guides/arkts-appstorage.md:712`

**本工程没有采用系统路由表**（`module.json5` 中无 `routerMap` 字段，
`resources/base/profile/` 下也没有 `router_map.json`，实测目录里只有
`backup_config.json` / `main_pages.json` / `network_config.json` / `player_form_config.json`）。
两方案官方都支持，本工程选了集中式 `@Builder` 映射 —— 好处是**路由名 → 组件 + 转场 + 背景色
集中在一处可读**，代价是 `Index.ets` 涨到 794 行。

---

## 7. 路由表（Index.ets routerMap）

从 `Index.ets:168-396` 的 `@Builder routerMap(name: string, param: object)` 逐条提取。
共 **25 个路由名**（其中 `ruleSourceExplore` / `ruleSourceLoginPanel` 共用一个分支）。

| # | 路由名 | 页面组件 | 容器 | 行号 |
|---|---|---|---|---|
| 1 | `home` | `MainPage` | `NavDestination` + `.hideTitleBar(true)` | `:170-187` |
| 2 | `detail` | `DetailPageWrapper` → `BookDetailPage` | `NavDestination`（自定义缩放淡入转场） | `:188-230` |
| 3 | `player` | `PlayerPageWrapper` → `PlayerPage` | `NavDestination`（自定义上滑/下滑转场） | `:231-284` |
| 4 | `reader` | `ReaderPageWrapper` → `ReaderPage` | `NavDestination` + `SLIDE_RIGHT` | `:285-293` |
| 5 | `search` | `SearchPage` | 无 NavDestination 包装 | `:294-295` |
| 6 | `readerKitVerify` | 内联占位 `Column`（功能已禁用） | `NavDestination` + `SLIDE_RIGHT` | `:296-310` |
| 7 | `settings` | `SettingsPage` | `ProfileMenuDestination` | `:311-314` |
| 8 | `ruleSources` | `RuleSourcePage` | 自带 `ProfileMenuDestination` | `:315-317` |
| 9 | `ruleSourceAccount` | `RuleSourceAccountPage` | `ProfileMenuDestination` | `:318-321` |
| 10 | `ruleSourceChildren` | `RuleSourceChildrenPage` | `ProfileMenuDestination`（`background_secondary`） | `:322-325` |
| 11 | `ruleSourceLogin` | `RuleSourceLoginPage` | `ProfileMenuDestination` | `:326-333` |
| 12 | `RuleSourceEditPage` ⚠️ | `RuleSourceEditPage` | 无 | `:334-338` |
| 13 | `RuleSourceDebugPage` ⚠️ | `RuleSourceDebugPage` | 无 | `:339-343` |
| 14 | `ruleSourceExplore` | `RuleSourcePanelPage`（`login: false`） | 无 | `:344-345` |
| 15 | `ruleSourceLoginPanel` | `RuleSourcePanelPage`（`login: true`） | 无 | `:344-345` |
| 16 | `downloads` | `DownloadManagerPage` | `ProfileMenuDestination`（`background_secondary`） | `:346-349` |
| 17 | `about` | `AboutPage` | `ProfileMenuDestination` | `:350-353` |
| 18 | `guide` | `GuidePage` | `ProfileMenuDestination` | `:354-357` |
| 19 | `import` | `ImportPage` | `ProfileMenuDestination` | `:358-361` |
| 20 | `stats` | `ReadingStatsPage` | `NavDestination` + `SLIDE_RIGHT` | `:362-368` |
| 21 | `unfavoriteHistory` | `UnfavoritedHistoryPage` | `NavDestination` + `SLIDE_RIGHT` | `:369-375` |
| 22 | `privacy` | `PrivacyPage` | `ProfileMenuDestination` | `:376-379` |
| 23 | `compliance` | `CompliancePage` | `ProfileMenuDestination` | `:380-383` |
| 24 | `openSource` | `OpenSourcePage` | `ProfileMenuDestination` | `:384-387` |
| 25 | `blockMore` | `BlockMorePageWrapper` → `BlockMorePage` | `NavDestination` + `SLIDE_RIGHT` | `:388-395` |

⚠️ 第 12/13 项是**命名违规**（PascalCase，其余为 kebab-case），见 [§2.2](#22-命名规则官方-vs-工程)。

### 7.1 参数传递约定

`param` 类型是 `object`，工程用三种解析方式：

```ts
// 1) 字符串直传
this.navStack.pushPathByName('detail', bookId, false);   // Index.ets:135

// 2) 记录型（Record<string, string>）—— 逐 key 取，带类型保护
private resolveParam(param: object, key: string): string {
  if (typeof param === 'string') return '';
  const r = param as Record<string, Object>;
  const v = r[key];
  return typeof v === 'string' ? v : '';
}
// Index.ets:98-103

// 3) 类实例（可 instanceof 判断）
if (name === 'ruleSourceLogin') {
  RuleSourceLoginPage({
    navStack: this.navStack,
    route: param instanceof RuleSourceLoginRouteParams ? param : new RuleSourceLoginRouteParams()
  })
}
// Index.ets:326-333
```

> ⚠️ **`param` 在跨进程/跨版本时会被序列化**，所以每个 Wrapper 都写了 `typeof param === 'string'`
> 的兜底分支（`PlayerPageWrapper.resolveBookId` `Index.ets:707-711`、
> `ReaderPageWrapper.resolveBookId` `:765-770`）。
> 直接 `param as string` 会在真实跳转时崩。

### 7.2 路由名常量建议

本工程路由名是**字面量散落在各页面**（如 `Index.ets:135` 的 `'detail'`、
`MainPage.ets` 里的跳转）。**未证实**是否存在集中常量表；
从代码看，跳转方都是在页面里直接写字面量。新工程建议抽出 `RouteName` 常量表以避免拼写漂移。

---

## 8. Service 单例标准模板

### 8.1 两种变体

工程里并存两种单例写法，**按是否需要懒加载选**：

#### 变体 A：`private static instance` + `getInstance()`（无状态/轻量）

```ts
export class ChapterCacheService {
  private static instance: ChapterCacheService | null = null;
  ...
  static getInstance(): ChapterCacheService {
    if (!ChapterCacheService.instance) {
      ChapterCacheService.instance = new ChapterCacheService();
    }
    return ChapterCacheService.instance;
  }
}
```
—— `entry/src/main/ets/service/ChapterCacheService.ets:52-53, 73-78`

#### 变体 B：`static get current`（可被 `@ObservedV2` 观测）

```ts
/** App 外观偏好。阅读纸张主题独立保存，不随 App 强调色变化。 */
@ObservedV2
export class AppAppearance {
  private static singleton: AppAppearance | null = null;

  static get current(): AppAppearance {
    if (AppAppearance.singleton === null) {
      AppAppearance.singleton = new AppAppearance();
    }
    return AppAppearance.singleton;
  }

  /** 0 为各控件默认材质，1–5 对应超薄至超厚。 */
  @Trace material: number = 0;
  /** 空字符串表示使用随深浅模式变化的默认品牌色。 */
  @Trace accent: string = '';
}
```
—— `entry/src/main/ets/model/AppAppearance.ets:1-18`

> 变体 B 用 `get current` 而非 `getInstance()`，是为了让调用点写成
> `AppAppearance.current.material`，读起来像属性而不是方法。
> 只要字段带 `@Trace`，UI 就能直接响应（`WebEngineGate.ets:8` 注释：
> 「模式仿 AuthService：`@ObservedV2` + `static get instance()` + `@Trace`，UI 直接读字段即可响应」）。

### 8.2 幂等 init 模板（推荐）

**关键点：把 `init()` 的 Promise 缓存起来，重复调用复用同一个 Promise；
失败时把缓存置回 `null` 以允许重试。**

```ts
export class PreferenceService {
  ...
  private static initPromise: Promise<void> | null = null;

  static async init(context: common.BaseContext): Promise<void> {
    // ...
    if (!PreferenceService.initPromise) {
      PreferenceService.initPromise = preferences.getPreferences(context, options).then(async (s) => {
        // ... 初始化
      });
    }
    await PreferenceService.initPromise;
  }
}
```
—— `entry/src/main/ets/service/PreferenceService.ets:158, 179-193`
（重置于 `:212`，复用处 `:217-218`）

更完整的**带失败重置**版本（`entry/src/main/ets/service/StatsService.ets:77-93`）：

```ts
private static initPromise: Promise<void> | undefined = undefined;
private static initialized: boolean = false;

static async init(context: common.Context): Promise<void> {
  if (StatsService.initialized) return;
  if (StatsService.initPromise === undefined) {
    StatsService.initPromise = StatsService.initialize(context).catch((error: Error): void => {
      StatsService.initPromise = undefined;   // 失败后允许下次重试
      // ...
    });
  }
  await StatsService.initPromise;
}
```

### 8.3 init 必须在 `EntryAbility.onCreate` 调用，且要带超时

工程把所有服务初始化收口在 `EntryAbility.onCreate` 的一个**限时初始化**里
（`EntryAbility.ets:54-105`）：

```ts
onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
  ...
  // 关键修复:限时初始化,避免后台恢复时阻塞过久导致系统 watchdog 杀进程
  this.initServicesWithTimeout().catch((err: Error) => {
    hilog.error(DOMAIN, TAG, 'Service initialization failed: %{public}s', err?.message ?? JSON.stringify(err));
    // 即使失败也要 markReady,避免 callee 永久等待
    AudioService.getInstance().markReady();
  });
  ...
}

private async initServicesWithTimeout(): Promise<void> {
  const INIT_TIMEOUT_MS = 5000;
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error('Initialization timeout')), INIT_TIMEOUT_MS);
  });
  try {
    await Promise.race([this.initServicesCore(), timeoutPromise]);
  } catch (err) {
    // 超时可能发生在 bootstrapAudioService 之前，必须 markReady，否则 whenReady 只能靠超时兜底
    AudioService.getInstance().markReady();
    this.scheduleDownloadRecovery();
  }
}
```

**可复用的三条规则**：

1. **5s 超时兜底**（`INIT_TIMEOUT_MS = 5000`，`EntryAbility.ets:87`）——
   从状态栏/小组件冷启动时系统期望快速响应。
2. **`markReady()` 在 `finally` 或 catch 里无条件调用**（`EntryAbility.ets:299-302`）——
   否则等待方 `whenReady()` 永久挂起。
3. **非关键初始化旁路化** —— 不阻塞主链路的能力用 `.catch()` 吞掉后继续：

```ts
// 本地规则是旁路能力：后台预热，但不阻塞下载和播放器状态恢复。
LocalRuleSourceRepository.init(this.context).catch((e: Error): void => {
  hilog.warn(DOMAIN, TAG, 'LocalRuleSourceRepository init failed: %{public}s', JSON.stringify(e));
});
```
—— `EntryAbility.ets:117-120`

### 8.4 上下文注入模板

服务需要 `Context` 时用 `setContext` 而非构造函数注入（因为服务是单例、
`Context` 要等 `onCreate` 才有）：

```ts
WidgetUpdater.setContext(this.context);
// 章节音频文件缓存的沙箱根目录
ChapterCacheService.getInstance().setContext(this.context);
DownloadService.getInstance().setContext(this.context);
// 缓存书改用文件持久化,注入 context 供 cacheDir 读写
DataService.setContext(this.context);
```
—— `EntryAbility.ets:62-67`

---

## 9. ArkUI V2 状态管理约定

### 9.1 只用 V2 装饰器

**工程约定：`@ComponentV2` 组件只用 V2 装饰器，不混用 V1。**
来源：`SKILL.md` 强制规范第 10 条「禁止 V1/V2 状态装饰器混用」+
`README.md`「App 使用 ArkUI V2 状态管理」。

> 官方立场：V1 与 V2 **可以**混用，但有边界。官方另有一篇
> 《状态管理 V1 和 V2 混用场景》（`references/huawei-docs/harmonyos-guides/v1v2-mixing.md`），
> 下分「API version 19 前」与「API version 19 及之后」两份指导。
> **本工程的「禁止混用」是更严格的工程约定，不是官方硬性要求。**

### 9.2 装饰器对照表

| 装饰器 | 官方定位 | 官方文档 | 工程用量（文件数） |
|---|---|---|---|
| `@ComponentV2` | V2 自定义组件 | `references/huawei-docs/harmonyos-references/ts-custom-component-decorator-componentv2.md` | **54** |
| `@Local` | 组件内部状态（API 12+） | `…/ts-state-management-local.md` | **37** |
| `@Param` | 组件外部输入 | `…/ts-state-management-param.md` | **50** |
| `@Event` | 规范组件输出 | `…/ts-state-management-event.md` | **18** |
| `@ObservedV2` + `@Trace` | 类属性变化观测 | `references/huawei-docs/harmonyos-guides/arkts-new-observedv2-and-trace.md` | **7 / 8** |
| `@Computed` | 计算属性 | `…/ts-state-management-computed.md` | **5** |
| `@Monitor` | 状态变量修改监听 | `…/ts-state-management-monitor.md` | **6** |
| `@Provider` / `@Consumer` | 跨层传递 | — | **0**（工程未用） |

> `@Local` 官方定义原文：
> > `@Local` 用于状态管理 V2 中，表示**组件内部的状态**，使得自定义组件内部的变量具有观测能力。
> > 适用于需要在自定义组件内部维护和观测局部状态的场景（如计数器、开关状态等）。
> > **从 API version 12 开始，支持该装饰器。**
> > —— `references/huawei-docs/harmonyos-references/ts-state-management-local.md:25-29`

### 9.3 典型写法

#### (a) 页面组件：`@Local` 持栈 + `@Param` 接参

```ts
@Entry
@ComponentV2
struct Index {
  @Local navStack: NavPathStack = new NavPathStack();
  @Local playerRenderGroup: boolean = false;
  @Local playerOpacity: number = 1;
  // detail 路由自定义转场:缩放淡入,无方向位移
  @Local detailScale: number = 1;
  @Local detailOpacity: number = 1;
  ...
}
```
—— `entry/src/main/ets/pages/Index.ets:51-59`

子组件接参（`Index.ets:416-419`）：

```ts
@ComponentV2
struct DetailPageWrapper {
  @Param navStack: NavPathStack = new NavPathStack();
  @Param bookId: string = '';
  ...
}
```

> **`@Param` 必须给默认值**（V2 要求），否则编译报错。工程里所有 `@Param` 都带默认值。

#### (b) `@Event` 输出回调

```ts
@ComponentV2
export struct MiniPlayer {
  @Event onExpand: () => void = () => {};
  ...
}
```
—— `entry/src/main/ets/components/MiniPlayer.ets:11`

#### (c) `@ObservedV2` + `@Trace` 全局状态

```ts
/** 模式仿 AuthService：@ObservedV2 + static get instance() + @Trace，UI 直接读字段即可响应。 */
@ObservedV2
export class WebEngineGate {
  ...
}
```
—— `entry/src/main/ets/service/WebEngineGate.ets:8-10`

字段级 `@Trace`（`entry/src/main/ets/model/AppAppearance.ets:16-18`）：

```ts
/** 0 为各控件默认材质，1–5 对应超薄至超厚。 */
@Trace material: number = 0;
/** 空字符串表示使用随深浅模式变化的默认品牌色。 */
@Trace accent: string = '';
```

跨页共享用 `AppStorageV2.connect`（`EntryAbility.ets:167`、`Index.ets` 等）：

```ts
const state = AppStorageV2.connect(PlayerState, PLAYER_STATE_KEY, () => new PlayerState())!;
```
—— `EntryAbility.ets:167`、`:211`、`:222`、`:243`

#### (d) `@Computed` 计算属性

```ts
@Computed
get chapterProgressPercent(): number {
  const durationMs: number = this.playerState.durationMs > 0
    ? this.playerState.durationMs
    : this.playerState.savedDurationMs;
  ...
}
```
—— `entry/src/main/ets/components/MiniPlayer.ets:13-17`

`@Computed` 用在**由 `@Param` / `@Local` 派生**的值上（`FavoritePage.ets:134-142` 的
`shelfAudioCount` / `shelfTextCount` 从 `favoriteBooks` 派生）。

#### (e) `@Monitor` 监听变化

```ts
@Monitor('mode', 'revision')
onReaderChanged(): void {
  this.cancelTurn();
}
```
—— `entry/src/main/ets/components/ReaderPageTurnComponent.ets:34-37`

支持**深层路径**（`entry/src/main/ets/pages/BookDetailPage.ets:69-73`）：

```ts
@Monitor('playerState.currentBook', 'playerState.currentChapter')
private onPlaybackChapterChanged(_monitor: IMonitor): void {
  if (this.displayedChapters.length === 0) return;
  this.refreshDisplayedChapters(this.displayedChapters);
}
```

也支持**多字段**（`ReaderContinuousComponent.ets:46, 49`）。

> `@Monitor` 回调可接收 `IMonitor` 参数，签名有两种：
> `(): void`（如 `ReaderPageTurnComponent.ets:35`）和
> `(_monitor: IMonitor): void`（如 `BookDetailPage.ets:70`）。两种都合法。

### 9.4 状态作用域选择决策

```
这个状态给谁用？
├─ 只在本组件内            → @Local
├─ 父传子                  → @Param（父侧直接传值）
├─ 子通知父                → @Event
├─ 由现有状态派生          → @Computed（不要手写 getter）
├─ 状态变化要触发副作用    → @Monitor
└─ 跨页面 / 跨组件共享
   ├─ 需要持久化语义（播放器等） → @ObservedV2 类 + AppStorageV2.connect(Class, KEY, factory)
   └─ 只在内存中共享             → @ObservedV2 类 + static get current / getInstance
```

### 9.5 长列表约定

- **必须 `LazyForEach` + 稳定 key，不得用 index 作 key**（`SKILL.md` 强制规范第 9 条）。
- 工程实测 **14 个文件**使用了 `LazyForEach`。
- **`IDataSource` 实现独立成文件**，不放页面内联。`entry/src/main/ets/utils/` 下有 6 个：
  `BookDataSource.ets`、`ChapterDataSource.ets`、`HomeBlockDataSource.ets`、
  `HomeCategoryOverviewDataSource.ets`、`HomeCategoryRowDataSource.ets`、
  `HomeRecommendationDataSource.ets`；
  消费方如 `pages/FavoritePage.ets`、`pages/SearchPage.ets`、`pages/BlockMorePage.ets`。

---

## 10. 构建与运行命令

### 10.1 命令行构建（官方推荐链路）

来自工程 `README.md`「开发与验证」章节原文：

> Agent 开发流程：修改 `.ets` 后先运行 `arkts_check`，再运行 `build_project` 增量构建，
> 成功后 `start_app`。工具不可用时：
>
> ```bash
> ohpm install
> hvigorw assembleHap --mode module -p product=default
> hvigorw assembleHap --mode module -p product=release
> ```

拆解：

```bash
# 1. 安装依赖（首次或 oh-package.json5 变更后）
ohpm install

# 2. 构建 debug HAP
hvigorw assembleHap --mode module -p product=default

# 3. 构建 release HAP
hvigorw assembleHap --mode module -p product=release
```

> 若 `hvigorw` 不在 PATH：用 DevEco Studio 安装目录下的同名脚本，
> 并把本机 Node 指向 IDE 自带版本（`README.md`）：
> > 切换本机构建套件时，将 `DEVECO_SDK_HOME` 指向 Release IDE 的 `sdk` 目录，
> > 并使用同一安装目录下的 Node/Hvigor。

### 10.2 构建产物约定

| 用途 | product | buildMode | 签名 |
|---|---|---|---|
| GitHub 开发签名 HAP | `default` | `release` | 本机调试证书 |
| 官方邀测 APP | `release` | `release` | AppGallery 正式发布证书 + `release / app_gallery` Profile |

`README.md` 原文：

> GitHub HAP 使用 `product=default, buildMode=release`；官方邀测 APP 使用
> `product=release, buildMode=release`，须绑定 AppGallery 正式发布证书与 `release / app_gallery` Profile。
> APP 包上传 AGC，GitHub 开发签名 HAP 供获授权设备安装。

### 10.3 构建前静态检查

```bash
# 工程自带 linter（code-linter.json5，含 12 条安全规则）
# DevEco Studio 内：Code Linter 面板；CLI 见 IDE 自带 codelinter 工具
```

## 10.4 测试

`README.md`：

> App 单测在 `entry/src/test/`，设备测试在 `entry/src/ohosTest/`。
> 来源改动验证导入、单源/批量测试、搜索、详情、阅读/播放及失败隔离；
> UI 改动按源工程的 `docs/APP_UI.md`（当前交互与回归清单）检查。

```bash
# 设备测试（需连接设备/模拟器）
hvigorw assembleHap --mode module -p product=default --target ohosTest
```

> ⚠️ 工程 `entry/build-profile.json5:30-32` 声明了 `ohosTest` target；
> 但**具体的测试执行命令未在 README 中给出**，标注为**未证实**。

### 10.5 发布前校验

```bash
python scripts/verify-release-package.py <APP或HAP路径> \
  --version 0.1.24 --version-code 1000024
```

> 核验 SDK 正式版标记、目标 API 24、最低 API 20、版本和 1024×1024 分层图标；
> 签名有效性另用 SDK 的 `hap-sign-tool verify-app` 检查。
> —— `README.md`「开发与验证」

---

## 11. 反模式

| 反模式 | 为什么错 | 正解 |
|---|---|---|
| 把所有页面都注册进 `main_pages.json` | 页面多了以后每页都要改配置，且无法用 `NavPathStack` 统一管理栈 | 只注册宿主 `Index`，其余用 `Navigation` 路由（§6） |
| 路由名用 PascalCase | 与 kebab-case 混用导致找不到路由（本工程已有 2 处违规，§2.2） | 统一 kebab-case |
| `param as string` 不做类型判断 | 跨进程跳转时 `param` 会变 | `typeof param === 'string'` 兜底（§7.1） |
| 在 `Service` 里 `import` ArkUI 组件 | 破坏分层，服务无法被卡片进程复用 | 服务只依赖 `@kit.*` API 与 `model/` |
| 服务初始化放在 `onWindowStageCreate` | 从卡片/通知冷启动时首帧被拖慢 | 放 `EntryAbility.onCreate` + 5s 超时（§8.3） |
| 服务 `init()` 不缓存 Promise | 多处并发调用会重复初始化，出现竞态 | `private static initPromise` 缓存（§8.2） |
| 服务 `init()` 失败后不重置缓存 | 一次失败永久不可用 | `.catch()` 里置回 `undefined`（`StatsService.ets:88-90`） |
| `whenReady()` 前不调 `markReady()` | 等待方永久挂起 | `finally` / `catch` 里无条件 `markReady()`（`EntryAbility.ets:299-302`） |
| 抄 `build-profile.json5` 的 `"26.0.0"` | API 20–25 设备装不上 | 用 `"6.0.0(20)"` / `"6.1.1(24)"`，新 API 用 `PlatformCompat` 分流（§1.1） |
| 把 `build-profile.json5`（含口令）提交进仓库 | 泄露签名材料 | 用 `signingConfigs: []` 模板 + `.gitignore`（§5.3） |
| V1/V2 装饰器混用 | 工程约定禁止；混用有官方边界限制 | 只用 V2 装饰器（§9.1） |
| `@Param` 不给默认值 | V2 编译报错 | 每个 `@Param` 都给默认值（§9.3a） |
| 手工写 getter 而不是 `@Computed` | 不会自动重算/不参与缓存 | 派生值一律 `@Computed` |
| 用 index 做 `LazyForEach` 的 key | 复用错位、状态串页 | 稳定业务 key（§9.5） |

---

## 12. 官方出处速查

| 主题 | 本地路径（本技能包内） | 官方 URL |
|---|---|---|
| 模块配置文件（module.json5 全字段） | `references/huawei-docs/harmonyos-guides/module-configuration-file.md` | `harmonyos-guides/module-configuration-file` |
| `@Local` / `@Param` / `@Event` / `@Computed` / `@Monitor` | `references/huawei-docs/harmonyos-references/ts-state-management-*.md` | 同名 |
| `@ObservedV2` / `@Trace` | `references/huawei-docs/harmonyos-guides/arkts-new-observedv2-and-trace.md` | 同名 |
| V2 状态管理总览 | `references/huawei-docs/harmonyos-guides/arkts-state-management-overview.md` | 同名 |
| V1/V2 混用边界 | `references/huawei-docs/harmonyos-guides/v1v2-mixing.md` | 同名 |
| `@ComponentV2` 组件 | `references/huawei-docs/harmonyos-references/ts-custom-component-decorator-componentv2.md` | 同名 |
| `Navigation` / `NavDestination` | `references/huawei-docs/harmonyos-references/ts-basic-components-navigation.md`、`…navdestination.md` | 同名 |
| `expandSafeArea`（挖孔 metadata 约束） | `references/huawei-docs/harmonyos-references/ts-universal-attributes-expand-safe-area.md` | 同名 |

便捷检索：

```bash
node scripts/search-docs.mjs "module.json5 pages" --catalog harmonyos-guides
node scripts/search-docs.mjs "@ObservedV2" --catalog harmonyos-guides
node scripts/search-docs.mjs "NavPathStack" --catalog harmonyos-references
```

---

## 13. 相关分技能

- 沉浸光感材质总览 → [../immersive-material/README.md](../immersive-material/README.md)
- 安全区 / 刘海 / 状态栏避让 → [../immersive-material/safe-area.md](../immersive-material/safe-area.md)
- 主题与外观设置 / 深浅色 → [../theming/README.md](../theming/README.md) *(规划中)*
- 导航条、页签、半模态等组件规范 → [../components/README.md](../components/README.md)
- 设计规范数值（圆角/间距/字号/标题栏/热区） → [../design-specs.md](../design-specs.md)

### 13.1 本目录内规划中的拆分文件

`skill.yaml` 的 routing 表把本目录拆成了 4 个入口，但目前只有 `README.md`。
**下表三个文件尚未创建，其内容已全部并入本文对应章节**：

| routing 声明（`skill.yaml`） | 状态 | 本文对应章节 |
|---|---|---|
| `references/project-architecture/README.md` | ✅ 已存在 | 全文 |
| `references/project-architecture/routing.md` | ⏳ 规划中 | [§6](#6-路由main_pagesjson--navigation)、[§7](#7-路由表indexets-routermap) |
| `references/project-architecture/state-management.md` | ⏳ 规划中 | [§9](#9-arkui-v2-状态管理约定) |
| `references/project-architecture/services.md` | ⏳ 规划中 | [§8](#8-service-单例标准模板) |

> 出处：`skill.yaml:48-57`（routing 表；本目录的 4 条匹配项）。按需拆分的目的是降低单次载入成本。

---

## 附：本文标注为「未证实」的结论

1. **`build-profile.json5` 里 `"26.0.0"` 的出现原因** —— 与 `build-profile.template.json5`、
   `AGENTS.md:151`、`README.md` 三方声明的 `6.1.1(24)` / `6.0.0(20)` 不一致，
   仓库内**无注释或提交信息解释**。
2. **`strictMode.caseSensitiveCheck` / `useNormalizedOHMUrl` 的官方逐字定义** ——
   在本地 4 万篇文档中**未检索到**；表中作用为工程实践理解。
3. **`ohosTest` 的具体执行命令** —— `entry/build-profile.json5:30-32` 声明了 target，
   但 `README.md` 未给出运行方式。
4. **是否存在集中的路由名常量表** —— 从代码看路由名是散落的字面量，
   未发现统一常量文件；**未证实**。
5. **`@Event` 回调的必填性 / `@Param` 默认值要求是否为框架强制** ——
   工程 100% 遵守，但**官方文档中的强制表述未逐字核对**。
6. **`hvigorw` 在非 DevEco 环境下是否可直接调用** —— `README.md` 给出命令但未说明
   PATH 配置；实践上需用 IDE 自带脚本（**未证实**）。
7. **`verify-release-package.py` 的参数含义** —— `README.md` 给出示例命令
   （`--version 0.1.24 --version-code 1000024`）与当前 `app.json5` 的
   `0.1.25 / 1000025` **不一致**（示例是上一个版本的），脚本本体未在本文核对范围内。
