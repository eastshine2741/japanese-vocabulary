import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deckApi } from '../../api/deckApi';
import { flashcardApi } from '../../api/flashcardApi';
import { songApi } from '../../api/songApi';
import { studyStatsApi } from '../../api/studyStatsApi';
import { useStudyStack, StudyStackState } from './useStudyStack';
import { StudySource } from './types';
import { FlashcardDTO } from '../../types/flashcard';
import { RecommendedSongItem, WordInSongItemDto, WordsInSongDto } from '../../types/song';

const native = vi.hoisted(() => ({ listeners: new Set<(state: string) => void>(), focused: true }));
vi.mock('react-native', () => ({
  Animated: {
    Value: class { setValue() {} },
    timing: () => ({ start: (done: () => void) => done() }),
    spring: () => ({ start() {} }),
  },
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, callback: (state: string) => void) => {
      native.listeners.add(callback);
      return { remove: () => native.listeners.delete(callback) };
    },
  },
  PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) },
}));
vi.mock('@react-navigation/native', () => ({ useIsFocused: () => native.focused }));
vi.mock('../../api/flashcardApi', () => ({ flashcardApi: { getDueCards: vi.fn(), review: vi.fn() } }));
vi.mock('../../api/deckApi', () => ({ deckApi: { getDecks: vi.fn().mockResolvedValue({ songDecks: [] }) } }));
vi.mock('../../api/songApi', () => ({
  songApi: { getRecommendations: vi.fn(), getWords: vi.fn(), studyBootstrap: vi.fn() },
}));
vi.mock('../../api/studyStatsApi', () => ({ studyStatsApi: { getHome: vi.fn() } }));
vi.mock('../../stores/studyStatsStore', () => ({ useStudyStatsStore: { getState: () => ({ invalidate: vi.fn() }) } }));

const source: StudySource = {
  deckId: 7, songId: 3, title: 'Song', artist: 'Artist', artworkUrl: null, dueCount: 30, totalCount: 40,
};
const card = (id: number): FlashcardDTO => ({
  id, wordId: id, japanese: '歌', reading: 'ウタ', senses: [], state: 0,
  due: '2026-09-05T00:00:00Z', intervals: null,
});
let stack: StudyStackState;
let renderer: ReactTestRenderer;
function Harness({ studySource = source }: { studySource?: StudySource }) {
  stack = useStudyStack({ mode: 'source', source: studySource });
  return null;
}
async function mount(studySource?: StudySource) {
  await act(async () => { renderer = create(React.createElement(Harness, { studySource })); });
}
async function rate(rating = 1) {
  await act(async () => { stack.reveal(); stack.selectRating(rating); });
  await act(async () => {
    const handlers = stack.panHandlers as unknown as {
      onPanResponderRelease: (event: unknown, gesture: { dy: number }) => void;
    };
    handlers.onPanResponderRelease({}, { dy: -100 });
  });
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-05T01:00:00Z'));
  vi.resetAllMocks();
  native.focused = true;
  vi.mocked(deckApi.getDecks).mockResolvedValue({ songDecks: [], nextCursor: null });
  vi.mocked(flashcardApi.review).mockResolvedValue({
    id: 1, state: 1, due: '2026-09-05T01:00:10Z', stability: 1, difficulty: 1,
  });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.useRealTimers();
});

it('advances to the already-buffered next card locally, without refetching', async () => {
  vi.mocked(flashcardApi.getDueCards)
    .mockResolvedValueOnce({ cards: [card(9), card(1)], totalCount: 2, nextDueAt: null });
  await mount();
  expect(flashcardApi.getDueCards).toHaveBeenCalledWith(7, 20);
  expect(stack.cards.map(c => c.id)).toEqual([9, 1]);
  await rate();
  expect(flashcardApi.review).toHaveBeenCalledWith(9, { rating: 1 });
  expect(stack.currentCard?.id).toBe(1);
  expect(stack.session.reviewedCount).toBe(1);
  expect(stack.session.queueTotal).toBe(2);
  expect(stack.revealed).toBe(false);
  // 다음 카드가 이미 버퍼에 있으면 스와이프 한 번에 서버를 다시 조회하지 않는다.
  expect(flashcardApi.getDueCards).toHaveBeenCalledTimes(1);
});

it('prefetches the next page once the local buffer drops to the threshold, deduping already-buffered cards', async () => {
  const initialCards = [1, 2, 3, 4, 5, 6].map(card);
  vi.mocked(flashcardApi.getDueCards)
    .mockResolvedValueOnce({ cards: initialCards, totalCount: 10, nextDueAt: null })
    .mockResolvedValueOnce({
      cards: [2, 3, 4, 5, 6, 7, 8, 9, 10].map(card),
      totalCount: 9,
      nextDueAt: null,
    });
  await mount();
  expect(stack.cards.map(c => c.id)).toEqual([1, 2, 3, 4, 5, 6]);
  // 남은 카드(6개)가 아직 임계값(5)보다 많으므로 이 시점엔 미리 불러오지 않는다.
  expect(flashcardApi.getDueCards).toHaveBeenCalledTimes(1);

  await rate();
  // 첫 카드를 넘기고 나면 남은 카드가 5개로 임계값에 닿아 다음 페이지를 불러온다.
  expect(flashcardApi.getDueCards).toHaveBeenNthCalledWith(2, 7, 26);
  expect(stack.cards.map(c => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(stack.currentCard?.id).toBe(2);
  expect(stack.session.queueTotal).toBe(10);
});

it('does not prefetch once every currently due card is already buffered', async () => {
  vi.mocked(flashcardApi.getDueCards)
    .mockResolvedValueOnce({ cards: [card(1), card(2), card(3)], totalCount: 3, nextDueAt: null });
  await mount();
  await rate();
  await rate();
  expect(stack.currentCard?.id).toBe(3);
  expect(flashcardApi.getDueCards).toHaveBeenCalledTimes(1);
});

it('passes leadWordId only on the initial load, not on a buffer-exhausted refresh', async () => {
  vi.mocked(flashcardApi.getDueCards)
    .mockResolvedValueOnce({ cards: [card(5)], totalCount: 1, nextDueAt: null })
    .mockResolvedValueOnce({ cards: [card(2)], totalCount: 1, nextDueAt: null });
  await mount({ ...source, leadWordId: 5 });
  expect(flashcardApi.getDueCards).toHaveBeenNthCalledWith(1, 7, 20, 5);
  expect(stack.cards.map(c => c.id)).toEqual([5]);
  await rate();
  // 버퍼가 바닥나 서버를 다시 확인할 때는 leadWordId 를 다시 보내지 않는다.
  expect(flashcardApi.getDueCards).toHaveBeenNthCalledWith(2, 7, 20);
  expect(stack.currentCard?.id).toBe(2);
});

it('refreshes at nextDueAt with buffered cards and reopens an empty queue', async () => {
  vi.mocked(flashcardApi.getDueCards)
    .mockResolvedValueOnce({ cards: [card(1), card(2)], totalCount: 2, nextDueAt: '2026-09-05T01:00:05Z' })
    .mockResolvedValueOnce({ cards: [], totalCount: 0, nextDueAt: '2026-09-05T01:00:10Z' })
    .mockResolvedValueOnce({ cards: [card(1)], totalCount: 1, nextDueAt: null });
  await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(stack.isComplete).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(stack.currentCard?.id).toBe(1);
  expect(stack.isComplete).toBe(false);
});

it('preserves revealed answers on periodic refresh and refreshes on resume', async () => {
  vi.mocked(flashcardApi.getDueCards).mockResolvedValue({ cards: [card(1)], totalCount: 1, nextDueAt: null });
  await mount();
  await act(async () => { stack.reveal(); stack.selectRating(3); });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(stack.revealed).toBe(true);
  expect(stack.selectedRating).toBe(3);
  await act(async () => { native.listeners.forEach(listener => listener('active')); });
  expect(flashcardApi.getDueCards).toHaveBeenCalledTimes(3);
  native.focused = false;
  await act(async () => renderer.update(React.createElement(Harness)));
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(flashcardApi.getDueCards).toHaveBeenCalledTimes(3);
  native.focused = true;
  await act(async () => renderer.update(React.createElement(Harness)));
  expect(flashcardApi.getDueCards).toHaveBeenCalledTimes(4);
});

it('does not resubmit a successful review when the following fetch fails', async () => {
  vi.mocked(flashcardApi.getDueCards)
    .mockResolvedValueOnce({ cards: [card(1)], totalCount: 1, nextDueAt: null })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ cards: [], totalCount: 0, nextDueAt: null });
  await mount();
  await rate();
  expect(stack.isError).toBe(true);
  expect(stack.session.reviewedCount).toBe(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
  expect(stack.isComplete).toBe(true);
  expect(flashcardApi.review).toHaveBeenCalledTimes(1);
});

it('counts a re-queued card only once toward the distinct session counter, keeps the denominator fixed', async () => {
  vi.mocked(flashcardApi.getDueCards)
    .mockResolvedValueOnce({ cards: [card(1), card(2)], totalCount: 2, nextDueAt: null })
    // 카드 1이 (예: '다시' 평가로) 짧은 간격 뒤 다시 due 가 되어 페이지네이션으로 재등장한다.
    .mockResolvedValueOnce({ cards: [card(1)], totalCount: 1, nextDueAt: null })
    .mockResolvedValueOnce({ cards: [], totalCount: 0, nextDueAt: null });
  await mount();
  await rate(); // 카드 1 첫 리뷰 — 로컬 버퍼의 카드 2로 이동
  await rate(); // 카드 2 리뷰 — 버퍼 소진, refreshDue 가 카드 1을 다시 가져온다
  expect(stack.currentCard?.id).toBe(1);
  expect(stack.session.reviewedCount).toBe(2);
  expect(stack.session.position).toBe(2);
  expect(stack.session.queueTotal).toBe(2);

  await rate(); // 카드 1 두 번째 리뷰 — distinct 카운트는 늘지 않아야 한다
  expect(stack.session.reviewedCount).toBe(3);
  expect(stack.session.position).toBe(2);
  expect(stack.session.queueTotal).toBe(2);
});

it('keeps failed reviews available for retry', async () => {
  vi.mocked(flashcardApi.getDueCards).mockResolvedValue({ cards: [card(1)], totalCount: 1, nextDueAt: null });
  vi.mocked(flashcardApi.review).mockRejectedValueOnce(new Error('offline'));
  await mount();
  await rate();
  expect(stack.currentCard?.id).toBe(1);
  expect(stack.reviewError).toBe('offline');
  expect(stack.session.reviewedCount).toBe(0);
  expect(flashcardApi.getDueCards).toHaveBeenCalledTimes(1);
});

// 홈 콜드스타트: due 덱이 하나도 없을 때 추천곡 미리보기 카드 → rating 확정 시 부트스트랩.
const recommendation: RecommendedSongItem = {
  id: 1, songId: 9, title: 'Rec Song', artist: 'Rec Artist', artworkUrl: null, weekStartDate: '2026-09-01',
};
const wordItem = (japanese: string, importanceScore: number, appearanceOrder = 0, overrides: Partial<WordInSongItemDto> = {}): WordInSongItemDto => ({
  japanese,
  surface: japanese,
  baseForm: japanese,
  reading: japanese,
  koreanText: `${japanese}-ko`,
  senses: [{ meaning: `${japanese}-ko`, partOfSpeech: 'NOUN' }],
  partOfSpeech: 'NOUN',
  partOfSpeechLabel: '명사',
  jlpt: 'N3',
  importanceScore,
  appearanceOrder,
  frequency: 1,
  lineIndexes: [0],
  isSavedGlobally: false,
  isSavedForSong: false,
  savedWordId: null,
  addRequest: { japanese, reading: japanese, senses: [], songId: 9 },
  ...overrides,
});
const wordsInSong = (words: WordInSongItemDto[]): WordsInSongDto => ({
  lyricId: 1,
  wordSummary: { topWords: [], jlptDistribution: {}, totalCandidateCount: words.length, defaultBulkAddCount: words.length },
  filterDefaults: { pos: [], jlpt: [], includeUnknownJlpt: true, sortDefault: 'APPEARANCE' },
  words,
  lineWordIndexes: {},
});
function HomeHarness() {
  stack = useStudyStack({ mode: 'home' });
  return null;
}
async function mountHome() {
  await act(async () => { renderer = create(React.createElement(HomeHarness)); });
}
beforeEach(() => {
  vi.mocked(studyStatsApi.getHome).mockResolvedValue({ currentStreak: 0, freezeCount: 0, freezeMax: 0, weekDots: [] });
});

it('shows a preview card for the most important eligible word of the recommended song when nothing is due', async () => {
  vi.mocked(songApi.getRecommendations).mockResolvedValue([recommendation]);
  vi.mocked(songApi.getWords).mockResolvedValue(wordsInSong([
    wordItem('低い', 10, 1),
    wordItem('高い', 99, 0),
  ]));
  await mountHome();
  expect(songApi.getWords).toHaveBeenCalledWith(9);
  expect(stack.currentCard?.japanese).toBe('高い');
  expect(stack.isComplete).toBe(false);
});

it('bootstraps the song and continues the session with the returned due cards on rating confirm', async () => {
  vi.mocked(songApi.getRecommendations).mockResolvedValue([recommendation]);
  vi.mocked(songApi.getWords).mockResolvedValue(wordsInSong([wordItem('高い', 99, 0)]));
  vi.mocked(songApi.studyBootstrap).mockResolvedValue({
    deckId: 42,
    cards: [card(2)],
    totalCount: 2,
    nextDueAt: null,
  });
  await mountHome();
  await rate(3);
  expect(songApi.studyBootstrap).toHaveBeenCalledWith(9, 3);
  expect(stack.cards.map(c => c.id)).toEqual([2]);
  expect(stack.currentCard?.source.deckId).toBe(42);
  expect(stack.session.queueTotal).toBe(2);
  expect(stack.reviewError).toBeNull();
});

it('falls back to the completion nudge when the recommended song has no eligible words', async () => {
  vi.mocked(songApi.getRecommendations).mockResolvedValue([recommendation]);
  vi.mocked(songApi.getWords).mockResolvedValue(wordsInSong([]));
  await mountHome();
  expect(stack.currentCard).toBeNull();
  expect(stack.isComplete).toBe(true);
  expect(stack.recommendedSource?.songId).toBe(9);
});

it('surfaces an error and leaves the card swiped away when bootstrap fails', async () => {
  vi.mocked(songApi.getRecommendations).mockResolvedValue([recommendation]);
  vi.mocked(songApi.getWords).mockResolvedValue(wordsInSong([wordItem('高い', 99, 0)]));
  vi.mocked(songApi.studyBootstrap).mockRejectedValue(new Error('offline'));
  await mountHome();
  await rate(3);
  expect(stack.reviewError).toBe('offline');
});
