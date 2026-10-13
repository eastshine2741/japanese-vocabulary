import { create } from 'zustand';
import { rewardCardApi } from '../api/rewardCardApi';
import { songApi } from '../api/songApi';
import { DUMMY_ARTIST_CARDS, DUMMY_SONG_CARDS, findDummyLyrics } from '../components/rewardCards/dummyRewardCards';
import { pickLines } from '../components/rewardCards/cardLyric';
import { serverTargetId, toArtistCard, toRevealTarget, toSongCard } from '../components/rewardCards/serverRewardCards';
import { CardSignature } from '../components/rewardCards/signature';
import { ArtistRewardCard, CardLyricLine, SongRewardCard } from '../components/rewardCards/types';
import { toCardLine } from '../components/songDetail/songCardSample';
import { preferenceStorage } from '../utils/preferenceStorage';
import type { RewardCardRevealDto } from '../types/rewardCard';

export type RewardCardKind = 'song' | 'artist';

/** 개발 빌드에서만 바꾼다. 더미는 서버 없이 모든 등급·재질을 보려고 남겨 둔다. */
export type RewardCardSource = 'dummy' | 'server';

/** 띄울 획득 연출 하나. 카드는 등급마다 새로 나오므로 연출은 늘 봉투·서명이다. */
export interface RewardCardRevealTarget {
  kind: RewardCardKind;
  cardId: string;
  /** 서버가 준 연출. 서명하면 발급한다. 개발용으로 다시 띄운 연출은 서버에 보내지 않는다. */
  server?: boolean;
}

interface CardSet {
  songCards: SongRewardCard[];
  artistCards: ArtistRewardCard[];
}

interface RewardCardState extends CardSet {
  source: RewardCardSource;
  dummy: CardSet;
  server: CardSet;
  serverStatus: 'idle' | 'loading' | 'ready' | 'error';
  /** 가사 고르기에 쓰는 곡 전체 가사. 카드 id 로 찾는다. */
  lyricLines: Record<string, CardLyricLine[]>;
  /** 띄울 연출 차례. 한 번에 하나만 열고, 닫히면 다음을 연다. */
  queue: RewardCardRevealTarget[];
  /** 지금 열려 있는 연출. */
  active: RewardCardRevealTarget | null;
  pendingChecked: boolean;
  /** 낡음 설명은 첫 곡 카드를 받을 때 한 번만 보여 준다. 기기에 남겨 앱을 다시 켜도 다시 띄우지 않는다. */
  wearIntroSeen: boolean;

  setSource: (source: RewardCardSource) => void;
  loadServerCards: () => Promise<void>;
  /** 서버 카드를 아직 안 받았으면 받는다. */
  ensureServerCards: () => void;
  /** rating 응답의 연출. 카드를 다시 받은 뒤 차례에 넣는다. 연속 학습 축하가 떠 있으면 그 화면이 닫힌 뒤에 뜬다. */
  receiveReveals: (reveals: RewardCardRevealDto[] | undefined) => Promise<void>;
  /** 앱을 연 뒤 한 번, 서명 전에 끈 카드를 다시 띄운다. */
  checkPendingOnce: () => Promise<void>;
  /** 개발용 — 가진 카드를 다시 획득 화면으로 띄운다. 서버에는 보내지 않는다. */
  revealCard: (kind: RewardCardKind, cardId: string) => void;
  /** 차례의 맨 앞을 연다. 열 연출이 없으면 null. */
  openNextReveal: () => RewardCardRevealTarget | null;
  closeReveal: () => void;
  markWearIntroSeen: () => void;
  loadWearIntroSeen: () => Promise<void>;
  /** 개발용 — 카드 규칙 설명을 다시 처음처럼 띄우게 한다. */
  resetWearIntroSeen: () => void;
  loadLyricLines: (cardId: string) => Promise<void>;
  /** 카드에 실을 가사 줄을 바꾼다. 빈 배열은 무시한다. */
  setLyric: (cardId: string, picked: number[]) => void;
  /** 서명은 발급 때 한 번만 받는다. 이미 서명한 카드나 빈 서명은 무시한다. */
  sign: (kind: RewardCardKind, cardId: string, signature: CardSignature) => void;
  reset: () => void;
}

const DUMMY: CardSet = { songCards: DUMMY_SONG_CARDS, artistCards: DUMMY_ARTIST_CARDS };
const EMPTY: CardSet = { songCards: [], artistCards: [] };

function mapCards<T extends { id: string }>(cards: T[], cardId: string, fn: (card: T) => T): T[] {
  return cards.map((card) => (card.id === cardId ? fn(card) : card));
}

const initial = {
  source: 'server' as RewardCardSource,
  ...EMPTY,
  dummy: DUMMY,
  server: EMPTY,
  serverStatus: 'idle' as const,
  lyricLines: {},
  queue: [],
  active: null,
  pendingChecked: false,
  wearIntroSeen: false,
};

export const useRewardCardStore = create<RewardCardState>((set, get) => {
  /** 지금 소스의 카드 묶음을 고치고 보이는 카드에도 반영한다. */
  const patch = (fn: (cards: CardSet) => Partial<CardSet>) =>
    set((state) => {
      const next = { ...state[state.source], ...fn(state[state.source]) };
      return { [state.source]: next, ...next } as Partial<RewardCardState>;
    });

  const findSong = (cardId: string) => get().songCards.find((card) => card.id === cardId);

  return {
    ...initial,

    setSource: (source) => {
      set((state) => ({ source, ...state[source], queue: [], active: null }));
      if (source === 'server') get().loadServerCards();
    },

    loadServerCards: async () => {
      set({ serverStatus: 'loading' });
      try {
        const res = await rewardCardApi.getCards();
        const server = { songCards: res.songCards.map(toSongCard), artistCards: res.artistCards.map(toArtistCard) };
        set((state) => ({ server, serverStatus: 'ready', ...(state.source === 'server' ? server : {}) }));
      } catch {
        set({ serverStatus: 'error' });
      }
    },

    ensureServerCards: () => {
      const { source, serverStatus } = get();
      if (source === 'server' && (serverStatus === 'idle' || serverStatus === 'error')) get().loadServerCards();
    },

    // 더미를 보는 동안엔 띄우지 않는다. 서버에 남아 있어 다음에 앱을 열면 다시 뜬다.
    receiveReveals: async (reveals) => {
      if (!reveals || reveals.length === 0 || get().source !== 'server') return;
      await get().loadServerCards();
      set((state) => ({ queue: [...state.queue, ...reveals.map(toRevealTarget)] }));
    },

    checkPendingOnce: async () => {
      if (get().pendingChecked || get().source !== 'server') return;
      set({ pendingChecked: true });
      try {
        await get().receiveReveals(await rewardCardApi.getPending());
      } catch {
        set({ pendingChecked: false });
      }
    },

    // 막 발급된 카드는 서명 전이다. 다시 띄워도 새로 서명하게 비운다.
    revealCard: (kind, cardId) => {
      patch((cards) =>
        kind === 'song'
          ? { songCards: mapCards(cards.songCards, cardId, (card) => ({ ...card, signature: null })) }
          : { artistCards: mapCards(cards.artistCards, cardId, (card) => ({ ...card, signature: null })) },
      );
      set((state) => ({ queue: [...state.queue, { kind, cardId }] }));
    },

    openNextReveal: () => {
      const { queue, active } = get();
      if (active || queue.length === 0) return null;
      const [next, ...rest] = queue;
      set({ active: next, queue: rest });
      return next;
    },

    closeReveal: () => set({ active: null }),

    markWearIntroSeen: () => {
      set({ wearIntroSeen: true });
      preferenceStorage.saveCardWearIntroSeen().catch(() => undefined);
    },

    loadWearIntroSeen: async () => {
      if (await preferenceStorage.getCardWearIntroSeen().catch(() => false)) set({ wearIntroSeen: true });
    },

    resetWearIntroSeen: () => {
      set({ wearIntroSeen: false });
      preferenceStorage.clearCardWearIntroSeen().catch(() => undefined);
    },

    loadLyricLines: async (cardId) => {
      if (get().lyricLines[cardId]) return;
      const songId = findSong(cardId)?.songId ?? null;
      const id = serverTargetId(cardId);
      let lines: CardLyricLine[];
      if (id == null || songId == null) {
        lines = findDummyLyrics(cardId);
      } else {
        try {
          lines = (await songApi.getLyrics(songId)).lines
            .filter((line) => line.originalText.trim() !== '' && (line.tokens?.length ?? 0) > 0)
            .map(toCardLine);
        } catch {
          return;
        }
      }
      set((state) => ({ lyricLines: { ...state.lyricLines, [cardId]: lines } }));
    },

    setLyric: (cardId, picked) => {
      if (picked.length === 0) return;
      const card = findSong(cardId);
      if (!card) return;
      const lines = get().lyricLines[cardId] ?? findDummyLyrics(cardId);
      patch((cards) => ({
        songCards: mapCards(cards.songCards, cardId, (c) => ({ ...c, lyric: pickLines(lines, picked), picked })),
      }));
      // 연출 중인 발급 전 카드는 서명할 때 함께 보낸다. 연출 없이 채운 카드는 서명이 비어도 발급된 카드다.
      const id = serverTargetId(cardId);
      const pendingIssue = card.signature === null && get().active?.cardId === cardId;
      if (id != null && !pendingIssue) {
        rewardCardApi.updateSongCardLyric(id, picked).catch(() => undefined);
      }
    },

    sign: (kind, cardId, signature) => {
      if (signature.length === 0) return;
      const signOnce = <T extends { signature: CardSignature | null }>(card: T): T =>
        card.signature === null ? { ...card, signature } : card;
      const before = kind === 'song' ? findSong(cardId) : get().artistCards.find((card) => card.id === cardId);
      if (!before || before.signature !== null) return;
      patch((cards) =>
        kind === 'song'
          ? { songCards: mapCards(cards.songCards, cardId, signOnce) }
          : { artistCards: mapCards(cards.artistCards, cardId, signOnce) },
      );

      const { active } = get();
      const id = serverTargetId(cardId);
      if (!active?.server || active.cardId !== cardId || id == null) return;
      const request =
        kind === 'song'
          ? rewardCardApi.issueSongCard(id, signature, (before as SongRewardCard).picked ?? [])
          : rewardCardApi.issueArtistCard(id, signature);
      const markIssued = <T extends { issued?: boolean }>(card: T): T => ({ ...card, issued: true });
      // 실패하면 서버엔 서명 전으로 남아 다음에 앱을 열 때 다시 서명한다.
      request
        .then(() =>
          patch((cards) =>
            kind === 'song'
              ? { songCards: mapCards(cards.songCards, cardId, markIssued) }
              : { artistCards: mapCards(cards.artistCards, cardId, markIssued) },
          ),
        )
        .catch(() => undefined);
    },

    // 기기에 남긴 값이라 로그아웃해도 유지한다.
    reset: () => set((state) => ({ ...initial, wearIntroSeen: state.wearIntroSeen })),
  };
});
