/**
 * PlatformCompat — API 能力分流
 *
 * 关键原则：**用设备实际 API 判断，不用编译期版本**。
 * 工程的 targetSdkVersion 会高于设备实际能力，用编译期常量判断必然出错。
 *
 * 复制到：entry/src/main/ets/utils/PlatformCompat.ets
 */

import { deviceInfo } from '@kit.BasicServicesKit';

/** 最低支持 API 20；按接口引入版本选择实现，不能用编译版本判断设备能力。 */
export class PlatformCompat {
  static supports(apiVersion: number): boolean {
    return deviceInfo.sdkApiVersion >= apiVersion;
  }

  /** ArkUI 沉浸光感（uiMaterial / systemMaterial）起点：API 26 */
  static get immersiveMaterial(): boolean {
    return PlatformCompat.supports(26);
  }

  /** HDS 浮动页签 / 迷你栏 / hdsMaterial 起点：API 23 */
  static get floatingTabs(): boolean {
    return PlatformCompat.supports(23);
  }

  /** Grid 内容偏移（contentStartOffset）起点：API 22 */
  static get gridInsets(): boolean {
    return PlatformCompat.supports(22);
  }
}

/**
 * 官方推荐的能力判断（API 26 起）。
 * 入参必须是**字面量**，传变量编译期不校验。
 */
export function immersiveAvailable(): boolean {
  return deviceInfo.apiAvailable('26.0.0');
}

/**
 * Grid 内容偏移的版本兼容写法：
 * API ≥ 22 用 contentStartOffset/contentEndOffset（首尾留白不占滚动区）；
 * API 20–21 退化为 padding（占滚动区）。
 */
export class CompatibleGridInsets implements AttributeModifier<GridAttribute> {
  private top: number;
  private bottom: number;
  private horizontal: number;

  constructor(top: number, bottom: number, horizontal: number) {
    this.top = top;
    this.bottom = bottom;
    this.horizontal = horizontal;
  }

  applyNormalAttribute(instance: GridAttribute): void {
    if (PlatformCompat.gridInsets) {
      instance.padding({ left: this.horizontal, right: this.horizontal })
        .contentStartOffset(this.top)
        .contentEndOffset(this.bottom);
    } else {
      instance.padding({
        left: this.horizontal,
        right: this.horizontal,
        top: this.top,
        bottom: this.bottom
      });
    }
  }
}
