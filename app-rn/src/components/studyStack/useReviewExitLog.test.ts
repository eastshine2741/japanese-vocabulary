import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { trackReviewExit } from '../../services/analytics';
import { useReviewExitLog } from './useReviewExitLog';
import type { StudyCard, StudySource } from './types';
import type { StudyStackState } from './useStudyStack';

const native = vi.hoisted(() => ({ listeners: new Set<(state: string) => void>() }));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_: string, callback: (state: string) => void) => {
      native.listeners.add(callback);
      return { remove: () => native.listeners.delete(callback) };
    },
  },
}));
vi.mock('../../services/analytics', () => ({ trackReviewExit: vi.fn() }));

const source: StudySource = {
  deckId: 7, songId: 3, title: 'Song', artist: 'Artist', artworkUrl: null, dueCount: 1, totalCount: 1,
};
const studyCard = (wordId: number, japanese: string): StudyCard => ({
  id: wordId, wordId, japanese, reading: null, senses: [], state: 0,
  due: '2026-10-27T00:00:00Z', intervals: null, memory: 'SHORT_TERM', source,
});
const stackOf = (currentCard: StudyCard | null, reviewedCount: number, isComplete = false) => ({
  currentCard, isComplete, revealed: true, status: 'ready', session: { reviewedCount },
}) as unknown as StudyStackState;

function Harness({ stack, active }: { stack: StudyStackState; active: boolean }) {
  useReviewExitLog(stack, { mode: 'home', active });
  return null;
}

let renderer: ReactTestRenderer;
const render = (stack: StudyStackState, active: boolean) => act(() => {
  if (renderer) renderer.update(React.createElement(Harness, { stack, active }));
  else renderer = create(React.createElement(Harness, { stack, active }));
});

beforeEach(() => {
  vi.mocked(trackReviewExit).mockClear();
  native.listeners.clear();
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined as unknown as ReactTestRenderer;
});

it('logs the card on screen when home loses focus, counting only ratings made since it gained focus', () => {
  render(stackOf(studyCard(5, '歌'), 4), true);
  render(stackOf(studyCard(6, '空'), 6), true);
  render(stackOf(studyCard(6, '空'), 6), false);
  expect(trackReviewExit).toHaveBeenCalledTimes(1);
  expect(trackReviewExit).toHaveBeenCalledWith(expect.objectContaining({
    mode: 'home', how: 'leave', word_id: 6, japanese: '空', card_song_id: 3, reviewed: 2,
  }));
});

it('logs on background and leaves the card out once the session is complete', () => {
  render(stackOf(null, 3, true), true);
  act(() => native.listeners.forEach(listener => listener('background')));
  const params = vi.mocked(trackReviewExit).mock.calls[0][0];
  expect(params).toMatchObject({ how: 'background', completed: true });
  expect(params).not.toHaveProperty('japanese');
});
