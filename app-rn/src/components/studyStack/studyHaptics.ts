import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { hapticsEnabled } from '../../stores/hapticStore';

// 카드마다 울리므로 가볍게 두고, 한 곡을 다 본 순간만 성공 진동으로 매듭짓는다.
const run = (fire: () => Promise<void>) => {
  if (Platform.OS === 'web' || !hapticsEnabled()) return;
  fire().catch(() => {});
};

/** 앞면을 눌러 뒤집을 때. */
export const hapticReveal = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** rating 을 고를 때. */
export const hapticRatingSelect = () => run(() => Haptics.selectionAsync());

/** 평가한 카드가 위로 밀려나갈 때 — 한 장을 끝냈다는 손맛. */
export const hapticCardDone = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** 한 곡의 복습을 다 마쳤을 때. */
export const hapticSessionComplete = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
