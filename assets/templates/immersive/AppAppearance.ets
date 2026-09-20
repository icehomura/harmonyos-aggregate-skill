/**
 * AppAppearance — 全局外观状态（材质档位 + 主题色）
 *
 * 用 ArkUI V2 的 @ObservedV2 + @Trace 实现全局单例：
 * 任意组件读到这两个字段后，字段变化时会自动重渲染。
 *
 * 复制到：entry/src/main/ets/model/AppAppearance.ets
 */

@ObservedV2
export class AppAppearance {
  private static singleton: AppAppearance | null = null;

  static get current(): AppAppearance {
    if (AppAppearance.singleton === null) {
      AppAppearance.singleton = new AppAppearance();
    }
    return AppAppearance.singleton;
  }

  /** 材质档位：0 = 各控件默认（推荐）；1–5 对应超薄 → 超厚 */
  @Trace material: number = 0;

  /** 主题色（十六进制）。空字符串表示使用资源里的默认品牌色 */
  @Trace accent: string = '';

  /** 归一化：非法值一律回落 0 */
  static normalizeMaterial(value: number): number {
    return Number.isInteger(value) && value >= 0 && value <= 5 ? value : 0;
  }

  /** 归一化：必须是 #RRGGBB（6 位、大写），否则回落空串（= 默认色） */
  static normalizeAccent(value: string): string {
    const hex: string = value.trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(hex) ? hex : '';
  }

  /** 按系数缩放色值，用于生成 hover / pressed 等派生色 */
  static shade(hex: string, scale: number): string {
    const red: number = Math.round(parseInt(hex.substring(1, 3), 16) * scale);
    const green: number = Math.round(parseInt(hex.substring(3, 5), 16) * scale);
    const blue: number = Math.round(parseInt(hex.substring(5, 7), 16) * scale);
    return '#' + red.toString(16).padStart(2, '0') + green.toString(16).padStart(2, '0') +
      blue.toString(16).padStart(2, '0');
  }

  /**
   * 按背景亮度选前景色（ITU-R BT.601）。
   * 用于自定义主题色上的对勾/文字，保证任何底色下都可读。
   */
  static foreground(hex: string): string {
    const red: number = parseInt(hex.substring(1, 3), 16);
    const green: number = parseInt(hex.substring(3, 5), 16);
    const blue: number = parseInt(hex.substring(5, 7), 16);
    return red * 0.299 + green * 0.587 + blue * 0.114 > 165 ? '#191919' : '#FFFFFF';
  }
}
