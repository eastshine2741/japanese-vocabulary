import { HomeStats } from '../types/studyStats';

/**
 * 연속 학습(260918) 프론트 선행 구현용 목업. 서버 `/api/study-stats/home` 이
 * `studiedToday` / `hasStudiedBefore` 를 주기 시작하면 이 파일과 호출부를 지운다.
 * 시나리오는 `EXPO_PUBLIC_MOCK_STREAK` 로 고른다 (기본 `pending`).
 */
export type StreakMockScenario = 'pending' | 'done' | 'broken' | 'first' | 'off';

const SCENARIOS: Record<Exclude<StreakMockScenario, 'off'>, Pick<HomeStats, 'currentStreak' | 'studiedToday' | 'hasStudiedBefore'>> = {
  /** 어제까지 3일, 오늘 아직 — 넛지 + 첫 rating 에 '4일째' 토스트. */
  pending: { currentStreak: 3, studiedToday: false, hasStudiedBefore: true },
  /** 오늘 이미 완료 — 넛지·토스트 없음. */
  done: { currentStreak: 4, studiedToday: true, hasStudiedBefore: true },
  /** 끊김 — 0일 + 넛지, 첫 rating 에 '다시 시작' 토스트. */
  broken: { currentStreak: 0, studiedToday: false, hasStudiedBefore: true },
  /** 한 번도 학습 안 함 — 0일 + 넛지, 첫 rating 에 '시작' 토스트. */
  first: { currentStreak: 0, studiedToday: false, hasStudiedBefore: false },
};

function scenario(): StreakMockScenario {
  const raw = process.env.EXPO_PUBLIC_MOCK_STREAK;
  return raw != null && raw in SCENARIOS ? raw as StreakMockScenario : raw === 'off' ? 'off' : 'pending';
}

/**
 * 서버가 `studiedToday` 를 아직 안 주면 시나리오 값으로 덮는다. 숫자와 오늘 여부가 서로
 * 맞아야 하므로 `currentStreak` 도 같이 덮는다. 서버가 주기 시작하면 서버 값이 이긴다.
 */
export function withStreakMock(stats: HomeStats): HomeStats {
  const name = scenario();
  if (name === 'off' || stats.studiedToday != null) return stats;
  return { ...stats, ...SCENARIOS[name] };
}
