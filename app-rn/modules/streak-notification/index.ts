import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type PressData = Record<string, string>;
type EventSubscription = { remove(): void };

type StreakNotificationNative = {
  showCountdown(
    title: string,
    body: string,
    channelId: string,
    expiresAt: number,
    data: PressData,
  ): Promise<boolean>;
  consumeInitialPress(): PressData | null;
  addListener(event: 'onPress', listener: (data: PressData) => void): EventSubscription;
};

// 이 모듈이 없는 네이티브 빌드(구버전)나 iOS 에서는 null — 호출부는 일반 알림으로 되돌아간다.
const native =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<StreakNotificationNative>('StreakNotification')
    : null;

/** 카운트다운 알림을 띄우면 true. 모듈이 없거나 이미 만료됐거나 권한이 없으면 false. */
export async function showStreakCountdown(input: {
  title: string;
  body: string;
  channelId: string;
  expiresAt: number;
  data: PressData;
}): Promise<boolean> {
  if (!native) return false;
  return native.showCountdown(input.title, input.body, input.channelId, input.expiresAt, input.data);
}

export function consumeInitialStreakPress(): PressData | null {
  return native?.consumeInitialPress() ?? null;
}

export function addStreakPressListener(listener: (data: PressData) => void): EventSubscription | null {
  return native?.addListener('onPress', listener) ?? null;
}
