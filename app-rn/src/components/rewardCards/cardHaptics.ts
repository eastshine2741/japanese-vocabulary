import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// 웹·진동 없는 기기에선 조용히 넘어간다.
const run = (fire: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  fire().catch(() => {});
};

/** 획득 연출에서 카드가 돌다 멈춰 내려앉는 순간. */
export const hapticLand = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

/** 서명을 확정할 때. */
export const hapticSign = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** 서명한 카드가 앞면으로 돌아서 내 카드가 되는 순간. */
export const hapticOwned = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
