import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { hapticsEnabled } from '../../stores/hapticStore';

/** 가사 줄이 한 칸 넘어갈 때 — 피커 눈금처럼 가볍게. 웹·진동 없는 기기에선 조용히 넘어간다. */
export const hapticLineTick = () => {
  if (Platform.OS === 'web' || !hapticsEnabled()) return;
  Haptics.selectionAsync().catch(() => {});
};
