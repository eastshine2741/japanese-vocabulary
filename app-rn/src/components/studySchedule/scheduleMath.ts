import { ScheduleForecastDay } from '../../types/studySchedule';

/** 예보 구간. 디자인의 날짜 라벨(오늘·1주·2주·3주·4주)이 이 길이를 전제한다. */
export const FORECAST_DAYS = 30;

/** 하루 목표 슬라이더 범위. 상한은 고정 상수다. */
export const DAILY_TARGET_MIN = 0;
export const DAILY_TARGET_MAX = 100;
export const DEFAULT_DAILY_TARGET = 30;

/**
 * 카드 한 장에 쓰는 시간. 소요 시간 문구("약 7분")는 전부 이 상수에서 나온다 —
 * 서버가 따로 내려주지 않는다.
 */
export const SECONDS_PER_CARD = 25;

/** 카드 수 -> 분. 0장이면 0분, 그 외에는 최소 1분. */
export function estimateMinutes(cards: number): number {
  if (cards <= 0) return 0;
  return Math.max(1, Math.round((cards * SECONDS_PER_CARD) / 60));
}

/**
 * 매일 미루면 쌓이는 양 — 날짜별 due 집계의 누적값.
 * 한 번 due 된 카드는 복습하기 전까지 계속 밀려 있으므로 그냥 더해 간다.
 */
export function cumulativeBacklog(days: ScheduleForecastDay[]): number[] {
  let acc = 0;
  return days.map(day => {
    acc += day.scheduledDue;
    return acc;
  });
}
