import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { hapticsEnabled } from '../../stores/hapticStore';

/** 가사 줄이 한 칸 넘어갈 때 — 피커 눈금처럼 가볍게. 웹·진동 없는 기기에선 조용히 넘어간다. */
export const hapticLineTick = () => {
  if (Platform.OS === 'web' || !hapticsEnabled()) return;
  Haptics.selectionAsync().catch(() => {});
};

/** 줄 공부에서 단어를 다 풀고 돌아와 잠긴 번역이 열릴 때 — 자물쇠가 풀리는 톡. */
export const hapticUnlock = () => {
  if (Platform.OS === 'web' || !hapticsEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** 열린 번역의 어절이 하나씩 차오를 때. */
export const hapticTranslationWord = hapticLineTick;

/** 번역의 마지막 어절까지 다 찼을 때. */
export const hapticTranslationOpened = () => {
  if (Platform.OS === 'web' || !hapticsEnabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};
