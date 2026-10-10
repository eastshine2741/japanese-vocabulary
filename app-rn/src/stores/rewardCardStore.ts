import { create } from 'zustand';
import { DUMMY_ARTIST_CARDS, DUMMY_SONG_CARDS, findDummyLyrics } from '../components/rewardCards/dummyRewardCards';
import { pickLines } from '../components/rewardCards/cardLyric';
import { CardSignature } from '../components/rewardCards/signature';
import { ArtistRewardCard, SongRewardCard } from '../components/rewardCards/types';

export type RewardCardKind = 'song' | 'artist';

export interface RewardCardRevealTarget {
  kind: RewardCardKind;
  cardId: string;
  /** 이미 가진 카드의 등급이 올랐다. 봉투·서명 없이 박은 자리에서 새 재질이 번진다. */
  upgrade?: boolean;
}

interface RewardCardState {
  songCards: SongRewardCard[];
  artistCards: ArtistRewardCard[];
  /** 막 얻은 카드. 채워지면 획득 화면을 열고, 연 직후 비운다. */
  reveal: RewardCardRevealTarget | null;
  /** 낡음 설명은 첫 곡 카드를 받을 때 한 번만 보여 준다. */
  wearIntroSeen: boolean;

  /** 카드를 얻는 조건이 채워진 직후 호출. 연속 학습 축하가 떠 있으면 그 화면이 닫힌 뒤에 뜬다. */
  revealCard: (kind: RewardCardKind, cardId: string) => void;
  /** 가진 카드의 등급이 오른 직후 호출. 획득 화면과 같은 자리에서 뜬다. */
  upgradeCard: (kind: RewardCardKind, cardId: string) => void;
  dismissReveal: () => void;
  markWearIntroSeen: () => void;
  /** 카드에 실을 가사 줄을 바꾼다. 빈 배열은 무시한다. */
  setLyric: (cardId: string, picked: number[]) => void;
  /** 서명은 발급 때 한 번만 받는다. 이미 서명한 카드나 빈 서명은 무시한다. */
  sign: (kind: RewardCardKind, cardId: string, signature: CardSignature) => void;
}

function signOnce<T extends { id: string; signature: CardSignature | null }>(cards: T[], cardId: string, signature: CardSignature): T[] {
  return cards.map((card) => (card.id === cardId && card.signature === null ? { ...card, signature } : card));
}

function clearSignature<T extends { id: string; signature: CardSignature | null }>(cards: T[], cardId: string): T[] {
  return cards.map((card) => (card.id === cardId ? { ...card, signature: null } : card));
}

// API 가 생기기 전이라 더미 카드를 들고 있고, 고른 가사·서명은 앱을 다시 켜면 사라진다.
export const useRewardCardStore = create<RewardCardState>((set) => ({
  songCards: DUMMY_SONG_CARDS,
  artistCards: DUMMY_ARTIST_CARDS,
  reveal: null,
  wearIntroSeen: false,

  // 막 발급된 카드는 서명 전이다. 더미 카드로 다시 띄워도 새로 서명하게 비운다.
  revealCard: (kind, cardId) =>
    set((state) =>
      kind === 'song'
        ? { reveal: { kind, cardId }, songCards: clearSignature(state.songCards, cardId) }
        : { reveal: { kind, cardId }, artistCards: clearSignature(state.artistCards, cardId) },
    ),

  upgradeCard: (kind, cardId) => set({ reveal: { kind, cardId, upgrade: true } }),

  dismissReveal: () => set({ reveal: null }),

  markWearIntroSeen: () => set({ wearIntroSeen: true }),

  setLyric: (cardId, picked) => {
    if (picked.length === 0) return;
    const lyric = pickLines(findDummyLyrics(cardId), picked);
    set((state) => ({
      songCards: state.songCards.map((card) => (card.id === cardId ? { ...card, lyric } : card)),
    }));
  },

  sign: (kind, cardId, signature) => {
    if (signature.length === 0) return;
    set((state) =>
      kind === 'song'
        ? { songCards: signOnce(state.songCards, cardId, signature) }
        : { artistCards: signOnce(state.artistCards, cardId, signature) },
    );
  },
}));
