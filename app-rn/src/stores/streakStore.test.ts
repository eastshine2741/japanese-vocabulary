import { afterEach, describe, expect, it } from 'vitest';
import { streakToastContent, useStreakStore } from './streakStore';

const store = () => useStreakStore.getState();

describe('streakToastContent (A-2 문구표)', () => {
  it('첫날: N=1, 이전 기록 없음', () => {
    expect(streakToastContent(1, false)).toEqual({ eyebrow: '연속 학습 시작', label: '오늘부터 함께 힘내요!' });
  });
  it('끊긴 뒤 재시작: N=1, 이전 기록 있음', () => {
    expect(streakToastContent(1, true)).toEqual({ eyebrow: '연속 학습 다시 시작', label: '돌아오신 걸 환영해요!' });
  });
  it('이어감: N>=2 는 이전 기록과 무관', () => {
    expect(streakToastContent(4, true)).toEqual({ eyebrow: '연속 학습 4일째', label: '4일째 이어가고 있어요!' });
    expect(streakToastContent(2, false)).toEqual({ eyebrow: '연속 학습 2일째', label: '2일째 이어가고 있어요!' });
  });
});

describe('streakStore', () => {
  afterEach(() => store().reset());

  it('홈 통계를 받기 전에는 rating 이 아무것도 바꾸지 않는다', () => {
    store().recordRating();
    expect(store().toast).toBeNull();
    expect(store().currentStreak).toBe(0);
    expect(store().studiedToday).toBe(false);
  });

  it('오늘 아직 → 첫 rating 에 숫자 +1, 완료 배너, 넛지 해제', () => {
    store().applyHomeStats({ currentStreak: 3, studiedToday: false, hasStudiedBefore: true });
    store().recordRating();
    expect(store().currentStreak).toBe(4);
    expect(store().studiedToday).toBe(true);
    expect(store().toast).toEqual({ eyebrow: '연속 학습 4일째', label: '4일째 이어가고 있어요!' });
  });

  it('같은 날 두 번째 rating 부터는 배너가 뜨지 않고 숫자도 그대로', () => {
    store().applyHomeStats({ currentStreak: 3, studiedToday: false, hasStudiedBefore: true });
    store().recordRating();
    store().dismissToast();
    store().recordRating();
    expect(store().toast).toBeNull();
    expect(store().currentStreak).toBe(4);
  });

  it('홈 진입 시 이미 완료면 rating 에 배너가 없다', () => {
    store().applyHomeStats({ currentStreak: 4, studiedToday: true, hasStudiedBefore: true });
    store().recordRating();
    expect(store().toast).toBeNull();
    expect(store().currentStreak).toBe(4);
  });

  it('끊긴 상태(0일)에서 첫 rating 은 1일 + 다시 시작 배너', () => {
    store().applyHomeStats({ currentStreak: 0, studiedToday: false, hasStudiedBefore: true });
    store().recordRating();
    expect(store().currentStreak).toBe(1);
    expect(store().toast?.eyebrow).toBe('연속 학습 다시 시작');
  });

  it('한 번도 학습 안 한 유저의 첫 rating 은 1일 + 시작 배너', () => {
    store().applyHomeStats({ currentStreak: 0, studiedToday: false, hasStudiedBefore: false });
    store().recordRating();
    expect(store().currentStreak).toBe(1);
    expect(store().toast?.eyebrow).toBe('연속 학습 시작');
  });

  it('홈 통계를 다시 받으면 서버 값이 이긴다 (다음 날 진입)', () => {
    store().applyHomeStats({ currentStreak: 3, studiedToday: false, hasStudiedBefore: true });
    store().recordRating();
    store().applyHomeStats({ currentStreak: 4, studiedToday: false, hasStudiedBefore: true });
    expect(store().studiedToday).toBe(false);
    store().recordRating();
    expect(store().currentStreak).toBe(5);
    expect(store().toast?.eyebrow).toBe('연속 학습 5일째');
  });
});
