import type React from 'react';
import type { DerivedValue, SharedValue } from 'react-native-reanimated';

export interface SpreadLayerProps {
  width: number;
  height: number;
  /** 지금 재질의 효과 없는 앞면. */
  before: React.ReactNode;
  /** 오른 재질의 효과 없는 앞면. */
  after: React.ReactNode;
  /** 새 재질이 번져 나가기 시작하는 자리. */
  focus: { x: number; y: number };
  /** 새 재질이 덮은 원의 반지름(px). */
  spread: DerivedValue<number>;
  /** 0→1 박힐 자리만 남기고 둘레를 어둡게 누른 정도. */
  spot: SharedValue<number>;
  /** 0→1 박힌 순간 터져 나가는 충격파의 진행. */
  shock: SharedValue<number>;
  /** 처음 박히는 자국의 반지름(px). */
  stampR: number;
  /** 번질 준비가 됐을 때. */
  onReady: () => void;
}

/** focus 에서 가장 먼 모서리까지 — 이만큼 번지면 카드를 다 덮는다. */
export function spreadReach(width: number, height: number, focus: { x: number; y: number }): number {
  return Math.max(
    Math.hypot(focus.x, focus.y),
    Math.hypot(width - focus.x, focus.y),
    Math.hypot(focus.x, height - focus.y),
    Math.hypot(width - focus.x, height - focus.y),
  );
}
