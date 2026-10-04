import client from './client';
import { flashcardApi } from './flashcardApi';
import { buildMockSchedule } from './mock/studyScheduleMock';
import { StudyScheduleResponse } from '../types/studySchedule';

/**
 * 서버에 `GET /api/study-schedule` 가 아직 없다. 생기면 이 상수만 false 로 바꾸면 된다.
 * 요청 스펙은 `docs/product-intents/261004-study-schedule-api.md`.
 */
const USE_MOCK_FORECAST = true;

/** 오늘 목록 미리보기에 띄우는 단어 칩 개수. */
const PREVIEW_WORD_LIMIT = 3;

export const studyScheduleApi = {
  async get(dailyTarget: number): Promise<StudyScheduleResponse> {
    if (!USE_MOCK_FORECAST) {
      const { data } = await client.get<StudyScheduleResponse>('/api/study-schedule', {
        params: { dailyTarget },
      });
      return data;
    }

    // due 수·전체 카드 수·미리보기 단어는 기존 API 의 진짜 값이다. 예보만 앱에서 꾸민다.
    const [stats, due] = await Promise.all([
      flashcardApi.getStats(),
      flashcardApi.getDueCards(undefined, PREVIEW_WORD_LIMIT),
    ]);
    return buildMockSchedule({
      dueToday: stats.due,
      totalCards: stats.total,
      previewWords: due.cards
        .slice(0, PREVIEW_WORD_LIMIT)
        .map(card => ({ wordId: card.wordId, japanese: card.japanese })),
      dailyTarget,
    });
  },
};
