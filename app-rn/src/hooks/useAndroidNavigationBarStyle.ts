import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

/** Android 내비게이션 바 톤 — `dark` 는 어두운 화면(밝은 버튼), `light` 는 밝은 화면(어두운 버튼). */
export type AndroidNavigationBarStyle = 'light' | 'dark';

const DEFAULT_STYLE: AndroidNavigationBarStyle = 'light';

// setStyle 은 네이티브 Promise 를 버려서, Activity 가 없을 때(백그라운드·재생성 중) reject 가 unhandled 로 샌다.
// 그때 못 바꾼 색은 다음 호출에서 다시 적용되니 버린다.
function applyStyle(style: AndroidNavigationBarStyle) {
  NavigationBar.setButtonStyleAsync(style === 'dark' ? 'light' : 'dark').catch(() => {});
}

/**
 * edge-to-edge 가 강제된 뒤로 내비게이션 바 배경은 늘 투명이고 앱이 그 아래까지 그린다.
 * 조절할 수 있는 건 버튼 색뿐이다.
 */
export function useAndroidNavigationBarStyle(style: AndroidNavigationBarStyle) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    applyStyle(style);
  }, [style]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    return () => applyStyle(DEFAULT_STYLE);
  }, []);
}
