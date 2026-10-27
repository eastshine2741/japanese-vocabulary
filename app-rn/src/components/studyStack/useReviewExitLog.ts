import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { trackReviewExit, type CardWordParams, type ReviewExitParams } from '../../services/analytics';
import { cardWordParams } from './types';
import type { StudyStackState } from './useStudyStack';

interface ReviewExitOptions {
  mode: ReviewExitParams['mode'];
  songId?: number | null;
  deckId?: number | null;
  /** 켜져 있는 동안을 한 번의 열림으로 센다. 곡 진입은 화면 수명, 홈은 포커스. */
  active: boolean;
}

/**
 * 몇 장째에서, 어떤 카드를 뒷면까지 본 채로 나갔는지 남긴다 — 떠나는 시점 값이 필요해 ref 로 따라간다.
 * 앱을 끄면 언마운트가 오지 않으니 백그라운드로 갈 때도 남긴다(how=background). 돌아와 이어서
 * 하면 같은 열림에 여러 건이 생기므로 분석은 열림마다 마지막 건을 본다.
 */
export function useReviewExitLog(stack: StudyStackState, { mode, songId, deckId, active }: ReviewExitOptions): void {
  const { currentCard, isComplete, revealed, session, status } = stack;
  const exitStateRef = useRef<{
    reviewed: number;
    revealed: boolean;
    completed: boolean;
    status: StudyStackState['status'];
    card: Partial<CardWordParams>;
  }>({ reviewed: 0, revealed, completed: isComplete, status, card: {} });
  exitStateRef.current = {
    reviewed: session.reviewedCount,
    revealed,
    completed: isComplete,
    status,
    card: !isComplete && currentCard ? cardWordParams(currentCard) : {},
  };
  useEffect(() => {
    if (!active) return;
    const openedAt = Date.now();
    // 홈은 세션이 포커스를 넘어 이어져 장 수가 쌓인다 — 이번 열림에서 평가한 것만 센다.
    const reviewedAtOpen = exitStateRef.current.reviewed;
    const log = (how: 'leave' | 'background') => {
      const { card, reviewed, ...state } = exitStateRef.current;
      trackReviewExit({
        mode,
        ...(songId != null && { song_id: songId }),
        ...(deckId != null && { deck_id: deckId }),
        ...card,
        how,
        ...state,
        reviewed: reviewed - reviewedAtOpen,
        dwell_sec: Math.round((Date.now() - openedAt) / 1000),
      });
    };
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background') log('background');
    });
    return () => {
      sub.remove();
      log('leave');
    };
    // 열림 한 번당 한 번 등록한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
