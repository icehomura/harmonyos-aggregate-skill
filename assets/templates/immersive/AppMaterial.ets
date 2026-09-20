/**
 * AppMaterial — 沉浸光感材质统一入口
 *
 * 设计约束（务必遵守）：
 *   1. 页面不得内联材质参数，一律经此工厂取用，否则「外观设置」无法全局生效
 *   2. 材质对象必须缓存 —— ImmersiveMaterial 构造开销大
 *   3. 缓存键必须含「档位 + 主题色」，任一变化即整表失效
 *   4. API < 26 走 backgroundColor + backgroundBlurStyle 磨砂回退
 *
 * 复制到：entry/src/main/ets/theme/AppMaterial.ets
 * 依赖：utils/PlatformCompat.ets、model/AppAppearance.ets
 */

import { uiMaterial } from '@kit.ArkUI';
import { PlatformCompat } from '../utils/PlatformCompat';
import { AppAppearance } from '../model/AppAppearance';

/** 品牌色。实际项目应读自资源或外观状态。 */
const BRAND: ResourceStr = $r('app.color.app_brand');

/** 回退色（API < 26 时使用）。浅色/深色由资源限定词区分。 */
const FALLBACK_CONTROL: ResourceColor = $r('app.color.glass_control_fallback');
const FALLBACK_SHEET: ResourceColor = $r('app.color.glass_sheet_fallback');

export class AppMaterial {
  private static cache: Map<string, uiMaterial.Material> = new Map();
  private static appearanceKey: string = '';

  /** 用户选的档位编号（0=默认，1–5 对应超薄→超厚）映射到官方枚举 */
  private static resolveStyle(fallback: uiMaterial.ImmersiveStyle): uiMaterial.ImmersiveStyle {
    switch (AppAppearance.current.material) {
      case 1: return uiMaterial.ImmersiveStyle.ULTRA_THIN;
      case 2: return uiMaterial.ImmersiveStyle.THIN;
      case 3: return uiMaterial.ImmersiveStyle.REGULAR;
      case 4: return uiMaterial.ImmersiveStyle.THICK;
      case 5: return uiMaterial.ImmersiveStyle.ULTRA_THICK;
      default: return fallback;   // 0 = 默认 → 各控件自己的推荐档位
    }
  }

  /** 回退磨砂档位（API 20–25 用） */
  private static get fallbackBlur(): BlurStyle {
    switch (AppAppearance.current.material) {
      case 1: return BlurStyle.COMPONENT_ULTRA_THIN;
      case 2: return BlurStyle.COMPONENT_THIN;
      case 4: return BlurStyle.COMPONENT_THICK;
      case 5: return BlurStyle.COMPONENT_ULTRA_THICK;
      default: return BlurStyle.COMPONENT_REGULAR;
    }
  }

  private static material(key: string, fallback: uiMaterial.ImmersiveStyle,
    shadow: boolean, interactive: boolean, invert: boolean = false,
    fixedStyle: boolean = false): uiMaterial.Material {
    const appearanceKey: string = AppAppearance.current.material.toString() + ':' + AppAppearance.current.accent;
    if (appearanceKey !== AppMaterial.appearanceKey) {
      AppMaterial.cache.clear();
      AppMaterial.appearanceKey = appearanceKey;
    }
    // ⚠️ 即使缓存命中也要读一次响应式 token：
    //    V2 的依赖登记发生在属性读取那一刻，提前 return 会导致换主题色后不刷新。
    const lightColor: ResourceColor = BRAND;
    const cached: uiMaterial.Material | undefined = AppMaterial.cache.get(key);
    if (cached !== undefined) return cached;

    const mat: uiMaterial.Material = new uiMaterial.ImmersiveMaterial({
      style: fixedStyle ? fallback : AppMaterial.resolveStyle(fallback),
      applyShadow: shadow,
      interactive: interactive,
      colorInvert: invert,
      lightEffect: { color: lightColor },
    });
    AppMaterial.cache.set(key, mat);
    return mat;
  }

  // ── 具名材质 ───────────────────────────────────────────
  // 官方选型指引：
  //   导航类（标题栏/页签）→ 较薄 ULTRA_THIN / THIN
  //   弹窗类（Menu/Dialog/Sheet/Toast）→ 较厚 THICK / ULTRA_THICK
  //   按钮与选择类 → 较薄 + interactive + lightEffect

  /** 交互控件：薄 + 无阴影 + 可交互 + 反色。浅色页面上的胶囊/圆形按钮 */
  static get InteractiveClean(): uiMaterial.Material | undefined {
    if (!PlatformCompat.immersiveMaterial) return undefined;
    return AppMaterial.material('interactiveClean', uiMaterial.ImmersiveStyle.THIN, false, true, true);
  }

  /** 交互控件（不反色）：用于内容色需保持原样的场景 */
  static get InteractiveThin(): uiMaterial.Material | undefined {
    if (!PlatformCompat.immersiveMaterial) return undefined;
    return AppMaterial.material('interactiveThin', uiMaterial.ImmersiveStyle.THIN, false, true);
  }

  /** 静态表面：薄 + 无阴影 + 不可交互 */
  static get SurfaceClean(): uiMaterial.Material | undefined {
    if (!PlatformCompat.immersiveMaterial) return undefined;
    return AppMaterial.material('surfaceClean', uiMaterial.ImmersiveStyle.THIN, false, false);
  }

  /** 浮动按钮：**最薄** + 阴影 + 可交互。深色/媒体页上的圆形按钮 */
  static get FloatingControl(): uiMaterial.Material | undefined {
    if (!PlatformCompat.immersiveMaterial) return undefined;
    return AppMaterial.material('floating', uiMaterial.ImmersiveStyle.ULTRA_THIN, true, true);
  }

  /** 弹层：薄 + 阴影。跟随外观厚度设置 */
  static get Sheet(): uiMaterial.Material | undefined {
    if (!PlatformCompat.immersiveMaterial) return undefined;
    return AppMaterial.material('sheet', uiMaterial.ImmersiveStyle.THIN, true, false);
  }

  /** 阅读弹层：**固定超厚**，不跟随外观设置，避免正文透出干扰 */
  static get ReaderSheetThick(): uiMaterial.Material | undefined {
    if (!PlatformCompat.immersiveMaterial) return undefined;
    return AppMaterial.material('readerSheetThick', uiMaterial.ImmersiveStyle.THICK, true, false, false, true);
  }

  /** 阅读底部胶囊栏：固定薄 + 阴影，同官方浮动页签视觉 */
  static get ReaderBar(): uiMaterial.Material | undefined {
    if (!PlatformCompat.immersiveMaterial) return undefined;
    return AppMaterial.material('readerBar', uiMaterial.ImmersiveStyle.THIN, true, false, false, true);
  }

  // ── 弹层（bindSheet）配套 ──────────────────────────────
  // API 26：透明 + 无 blurStyle，让原生材质自己画背景
  // API < 26：系统底色 + 磨砂

  static get SheetBackground(): ResourceColor {
    return PlatformCompat.immersiveMaterial ? Color.Transparent : FALLBACK_SHEET;
  }

  static get SheetBlur(): BlurStyle | undefined {
    return PlatformCompat.immersiveMaterial ? undefined : AppMaterial.fallbackBlur;
  }

  // ── 注入器 ─────────────────────────────────────────────

  static modifier(material: uiMaterial.Material | undefined,
    fallbackColor: ResourceColor = FALLBACK_CONTROL,
    fallbackShadow: ShadowOptions | undefined = undefined): CompatibleMaterialModifier {
    return new CompatibleMaterialModifier(material, fallbackColor, AppMaterial.fallbackBlur, fallbackShadow);
  }
}

/**
 * 双路径材质注入器。
 *
 * 注意：材质会覆盖 backgroundColor / border / shadow，
 * 所以描边必须单独占一层（见 GlassSurface 模板）。
 */
class CompatibleMaterialModifier implements AttributeModifier<CommonAttribute> {
  private material: uiMaterial.Material | undefined;
  private fallbackColor: ResourceColor;
  private blur: BlurStyle;
  private fallbackShadow: ShadowOptions | undefined;

  constructor(material: uiMaterial.Material | undefined, fallbackColor: ResourceColor,
    blur: BlurStyle, fallbackShadow: ShadowOptions | undefined = undefined) {
    this.material = material;
    this.fallbackColor = fallbackColor;
    this.blur = blur;
    this.fallbackShadow = fallbackShadow;
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    if (PlatformCompat.immersiveMaterial && this.material !== undefined) {
      instance.systemMaterial(this.material);
    } else {
      instance.backgroundColor(this.fallbackColor).backgroundBlurStyle(this.blur);
      if (this.fallbackShadow !== undefined) {
        instance.shadow(this.fallbackShadow);
      }
    }
  }
}
