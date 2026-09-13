import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

/** Android 내비게이션 바 톤 — `dark` 는 어두운 화면(밝은 버튼), `light` 는 밝은 화면(어두운 버튼). */
export type AndroidNavigationBarStyle = 'light' | 'dark';

const DEFAULT_STYLE: AndroidNavigationBarStyle = 'light';

/**
 * edge-to-edge 가 강제된 뒤로 내비게이션 바 배경은 늘 투명이고 앱이 그 아래까지 그린다.
 * 조절할 수 있는 건 버튼 색뿐이다.
 */
export function useAndroidNavigationBarStyle(style: AndroidNavigationBarStyle) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setStyle(style);
  }, [style]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    return () => NavigationBar.setStyle(DEFAULT_STYLE);
  }, []);
}
