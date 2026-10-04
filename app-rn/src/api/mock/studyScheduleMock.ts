import { FORECAST_DAYS } from '../../components/studySchedule/scheduleMath';
import {
  ScheduleForecastDay,
  SchedulePreviewWord,
  StudyScheduleResponse,
} from '../../types/studySchedule';

/**
 * `GET /api/study-schedule` 가 서버에 아직 없다. 화면이 먼저 나와야 해서 날짜별 예보만
 * 앱에서 꾸며 낸다 — 실제 FSRS 시뮬레이션은 서버가 한다.
 * 필요한 서버 지원은 `docs/product-intents/261004-study-schedule-api.md` 에 적어 뒀다.
 *
 * due 수·전체 카드 수·미리보기 단어는 이미 있는 API 에서 받은 진짜 값을 그대로 쓴다.
 * 꾸며 내는 건 `days` 뿐이다.
 */

/** 30일 안에 이 비율만큼의 카드가 한 번쯤 due 가 된다고 본다. */
const HORIZON_COVERAGE = 0.95;
/** 날짜별 due 가 평균 대비 흔들리는 폭. */
const DAILY_JITTER = 0.45;

/** 시드 하나로 늘 같은 그래프가 나오게 하는 LCG. */
function pseudoRandom(seed: number): () => number {
  let state = (seed * 2654435761) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function toISODate(base: Date, offsetDays: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export interface MockScheduleInput {
  dueToday: number;
  totalCards: number;
  previewWords: SchedulePreviewWord[];
  dailyTarget: number;
}

export function buildMockSchedule({
  dueToday,
  totalCards,
  previewWords,
  dailyTarget,
}: MockScheduleInput): StudyScheduleResponse {
  const today = new Date();
  const random = pseudoRandom(totalCards * 1000 + dueToday + 1);

  // 0일차는 이미 밀린 due 를 전부 안고 시작하고, 나머지 날짜가 남은 카드를 나눠 가진다.
  const spread = Math.max(0, Math.round(totalCards * HORIZON_COVERAGE) - dueToday);
  const perDay = spread / Math.max(1, FORECAST_DAYS - 1);
  const scheduled = Array.from({ length: FORECAST_DAYS }, (_, i) => {
    if (i === 0) return dueToday;
    return Math.max(0, Math.round(perDay * (1 + (random() - 0.5) * 2 * DAILY_JITTER)));
  });

  // 매일 큐 앞에서 dailyTarget 장씩 걷어 내는 모습만 재현한다. 복습한 카드가 30일 안에
  // 다시 돌아오는 경우는 서버 시뮬레이션의 몫이라 여기서는 다루지 않는다.
  let pending = 0;
  const days: ScheduleForecastDay[] = scheduled.map((scheduledDue, i) => {
    pending += scheduledDue;
    const simulatedReview = Math.min(pending, Math.max(0, dailyTarget));
    pending -= simulatedReview;
    return { date: toISODate(today, i), scheduledDue, simulatedReview };
  });

  return { dueToday, totalCards, previewWords, dailyTarget, days };
}
