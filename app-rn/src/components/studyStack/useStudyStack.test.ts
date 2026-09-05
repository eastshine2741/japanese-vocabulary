import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { deckApi } from '../../api/deckApi';
import { flashcardApi } from '../../api/flashcardApi';
import { useStudyStack, StudyStackState } from './useStudyStack';
import { StudySource } from './types';
import { FlashcardDTO } from '../../types/flashcard';

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
vi.mock('../../api/songApi', () => ({ songApi: {} }));
vi.mock('../../api/studyStatsApi', () => ({ studyStatsApi: {} }));
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
function Harness() { stack = useStudyStack({ mode: 'source', source }); return null; }
async function mount() { await act(async () => { renderer = create(React.createElement(Harness)); }); }
async function rate() {
  await act(async () => { stack.reveal(); stack.selectRating(1); });
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

it('keeps server order and total count, and allows reviewed cards to return', async () => {
  vi.mocked(flashcardApi.getDueCards)
    .mockResolvedValueOnce({ cards: [card(9), card(1)], totalCount: 30, nextDueAt: null })
    .mockResolvedValueOnce({ cards: [card(9), card(2)], totalCount: 29, nextDueAt: null });
  await mount();
  expect(flashcardApi.getDueCards).toHaveBeenCalledWith(7, 20);
  expect(stack.cards.map(c => c.id)).toEqual([9, 1]);
  expect(stack.session.queueTotal).toBe(30);
  await rate();
  expect(flashcardApi.review).toHaveBeenCalledWith(9, { rating: 1 });
  expect(stack.currentCard?.id).toBe(9);
  expect(stack.session.reviewedCount).toBe(1);
  expect(stack.revealed).toBe(false);
  expect(flashcardApi.getDueCards).toHaveBeenCalledTimes(2);
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
