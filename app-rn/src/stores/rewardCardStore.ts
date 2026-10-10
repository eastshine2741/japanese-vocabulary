import { create } from 'zustand';
import { DUMMY_SONG_CARDS, findDummyLyrics } from '../components/rewardCards/dummyRewardCards';
import { pickLines } from '../components/rewardCards/cardLyric';
import { CardSignature } from '../components/rewardCards/signature';
import { SongRewardCard } from '../components/rewardCards/types';

interface RewardCardState {
  songCards: SongRewardCard[];
  /** 막 얻은 곡 카드 id. 채워지면 획득 화면을 열고, 연 직후 비운다. */
  revealCardId: string | null;

  /** 카드를 얻는 조건이 채워진 직후 호출. 연속 학습 축하가 떠 있으면 그 화면이 닫힌 뒤에 뜬다. */
  revealCard: (cardId: string) => void;
  dismissReveal: () => void;
  /** 카드에 실을 가사 줄을 바꾼다. 빈 배열은 무시한다. */
  setLyric: (cardId: string, picked: number[]) => void;
  /** 서명은 발급 때 한 번만 받는다. 이미 서명한 카드나 빈 서명은 무시한다. */
  sign: (cardId: string, signature: CardSignature) => void;
}

// API 가 생기기 전이라 더미 카드를 들고 있고, 고른 가사·서명은 앱을 다시 켜면 사라진다.
export const useRewardCardStore = create<RewardCardState>((set) => ({
  songCards: DUMMY_SONG_CARDS,
  revealCardId: null,

  // 막 발급된 카드는 서명 전이다. 더미 카드로 다시 띄워도 새로 서명하게 비운다.
  revealCard: (cardId) =>
    set((state) => ({
      revealCardId: cardId,
      songCards: state.songCards.map((card) => (card.id === cardId ? { ...card, signature: null } : card)),
    })),

  dismissReveal: () => set({ revealCardId: null }),

  setLyric: (cardId, picked) => {
    if (picked.length === 0) return;
    const lyric = pickLines(findDummyLyrics(cardId), picked);
    set((state) => ({
      songCards: state.songCards.map((card) => (card.id === cardId ? { ...card, lyric } : card)),
    }));
  },

  sign: (cardId, signature) => {
    if (signature.length === 0) return;
    set((state) => ({
      songCards: state.songCards.map((card) =>
        card.id === cardId && card.signature === null ? { ...card, signature } : card,
      ),
    }));
  },
}));
