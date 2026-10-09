import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type PressData = Record<string, string>;
type EventSubscription = { remove(): void };

type StreakNotificationNative = {
  show(
    title: string,
    body: string,
    channelId: string,
    expiresAt: number | null,
    accentColor: string,
    accentColorNight: string,
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

/** 띄우면 true. 모듈이 없거나 권한이 없으면 false. expiresAt 이 있고 아직 안 지났으면 카운트다운을 붙인다. */
export async function showStreakNotification(input: {
  title: string;
  body: string;
  channelId: string;
  expiresAt: number | null;
  /** 알림 셰이드 배경이 밝을 때. */
  accentColor: string;
  /** 시스템 다크 모드일 때. */
  accentColorNight: string;
  data: PressData;
}): Promise<boolean> {
  if (!native) return false;
  return native.show(
    input.title,
    input.body,
    input.channelId,
    input.expiresAt,
    input.accentColor,
    input.accentColorNight,
    input.data,
  );
}

export function consumeInitialStreakPress(): PressData | null {
  return native?.consumeInitialPress() ?? null;
}

export function addStreakPressListener(listener: (data: PressData) => void): EventSubscription | null {
  return native?.addListener('onPress', listener) ?? null;
}
