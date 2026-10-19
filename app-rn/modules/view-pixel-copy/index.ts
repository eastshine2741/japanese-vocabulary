import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type ViewPixelCopyNative = {
  capture(viewTag: number): Promise<string>;
};

// 이 모듈이 없는 네이티브 빌드(구버전)나 iOS 에서는 null.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<ViewPixelCopyNative>('ViewPixelCopy') : null;

export const viewPixelCopySupported = native != null;

/** 뷰가 화면에 보이는 그대로의 PNG base64. 가려진 부분까지 같이 찍히니 위에 아무것도 없을 때 부른다. */
export function captureViewPixels(viewTag: number): Promise<string> {
  if (!native) return Promise.reject(new Error('ViewPixelCopy is not available'));
  return native.capture(viewTag);
}
