import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// 웹·진동 없는 기기에선 조용히 넘어간다.
const run = (fire: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  fire().catch(() => {});
};

const impact = (style: Haptics.ImpactFeedbackStyle) => run(() => Haptics.impactAsync(style));

/** 봉투 띠를 뜯는 동안 한 칸마다. 끝에 가까울수록 세게. */
export const hapticTear = (progress: number) =>
  impact(progress < 0.5 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);

/** 획득 순번이 멈추는 순간 — 무거운 한 방에 성공 진동을 바로 겹친다. */
export const hapticLand = () => {
  impact(Haptics.ImpactFeedbackStyle.Heavy);
  setTimeout(() => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), 70);
};

/** 다 찢은 뒤 터지기까지 — 두두두 점점 빠르고 세게 몰아친다. */
export const hapticCharge = (ms: number) => {
  const beats = [0, 0.3, 0.52, 0.68, 0.8, 0.89, 0.95];
  beats.forEach((t, i) =>
    setTimeout(
      () => impact(i < 2 ? Haptics.ImpactFeedbackStyle.Light : i < 5 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy),
      t * ms,
    ),
  );
};

/** 봉투가 터지는 순간 — 무거운 두 방. 성공 진동은 카드가 제자리에 박힐 때 준다. */
export const hapticBurst = () => {
  impact(Haptics.ImpactFeedbackStyle.Heavy);
  setTimeout(() => impact(Haptics.ImpactFeedbackStyle.Heavy), 80);
};

/** 돌며 나오는 카드의 옆면이 지날 때. 멈출 무렵엔 조금 세게. */
export const hapticSpin = (progress: number) =>
  impact(progress < 0.7 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);

/** 다 돈 카드가 제자리에 박히는 순간 — 무거운 두 방에 성공 진동. */
export const hapticSettle = () => {
  impact(Haptics.ImpactFeedbackStyle.Heavy);
  setTimeout(() => impact(Haptics.ImpactFeedbackStyle.Heavy), 60);
  setTimeout(() => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), 140);
};

/** 승급 계단이 한 칸 찰 때. 지금 자리에 닿으면 조금 세게. */
export const hapticRung = (last: boolean) =>
  impact(last ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

/** 서명을 확정할 때. */
export const hapticSign = () => impact(Haptics.ImpactFeedbackStyle.Light);

/** 서명한 카드가 앞면으로 돌아섰을 때. 마지막 한 방은 순번이 멈출 때 준다. */
export const hapticOwned = () => impact(Haptics.ImpactFeedbackStyle.Medium);

/** 획득 순번이 올라가는 동안 숫자가 바뀔 때마다. */
export const hapticCount = () => run(() => Haptics.selectionAsync());
