import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { userProfileApi } from '../api/userProfileApi';
import { CardSet, toCardSet, useRewardCardStore } from './rewardCardStore';

type CardsStatus = 'loading' | 'ready' | 'error';

/** 남의 프로필 카드. 프로필 화면과 그 위에 올린 카드 전시 화면이 유저 id 로 같이 본다. */
interface UserProfileState {
  cards: Record<number, CardSet>;
  cardsStatus: Record<number, CardsStatus>;
  loadCards: (userId: number) => Promise<void>;
}

export const useUserProfileStore = create<UserProfileState>((set) => ({
  cards: {},
  cardsStatus: {},

  loadCards: async (userId) => {
    set((state) => ({ cardsStatus: { ...state.cardsStatus, [userId]: 'loading' } }));
    try {
      const cards = await toCardSet(await userProfileApi.getRewardCards(userId));
      set((state) => ({
        cards: { ...state.cards, [userId]: cards },
        cardsStatus: { ...state.cardsStatus, [userId]: 'ready' },
      }));
    } catch {
      set((state) => ({ cardsStatus: { ...state.cardsStatus, [userId]: 'error' } }));
    }
  },
}));

const NO_CARDS: CardSet = { songCards: [], artistCards: [], songGradeRule: null };

/** 카드 전시 화면이 보는 카드 주인의 카드. userId 가 없으면 내 카드다. loading 은 아직 한 번도 못 받았다는 뜻이다. */
export function useOwnerCards(userId: number | undefined): CardSet & { loading: boolean } {
  const mine = useRewardCardStore(
    useShallow((s) => ({
      songCards: s.songCards,
      artistCards: s.artistCards,
      songGradeRule: s.songGradeRule,
      loading: s.source === 'server' && (s.serverStatus === 'idle' || s.serverStatus === 'loading'),
    })),
  );
  const theirs = useUserProfileStore(
    useShallow((s) => ({
      cards: userId == null ? undefined : s.cards[userId],
      status: userId == null ? undefined : s.cardsStatus[userId],
    })),
  );
  if (userId == null) return mine;
  return { ...(theirs.cards ?? NO_CARDS), loading: theirs.status == null || theirs.status === 'loading' };
}
