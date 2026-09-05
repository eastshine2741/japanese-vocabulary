import { SongDeckSummary } from '../../types/deck';
import { RecommendedSongItem } from '../../types/song';
import { StudyCard, StudyCardOrigin, StudySource } from './types';

// deckId 는 null 이어야 한다 — 실제 deck 인지 mock 인지 판별하는 유일한 기준이다.
export const MOCK_RECOMMENDED_SOURCE: StudySource = {
  deckId: null,
  songId: 103,
  title: 'アイドル',
  artist: 'YOASOBI',
  artworkUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80',
  dueCount: 2,
  totalCount: 24,
};

export function makeMockCards(source: StudySource, origin: StudyCardOrigin): StudyCard[] {
  const base = source.title === '夜に駆ける'
    ? [
        { id: 9201, japanese: '沈む', reading: 'しずむ', meaning: '가라앉다', example: '沈むように溶けてゆくように', translation: '가라앉듯 녹아가듯' },
        { id: 9202, japanese: '夜', reading: 'よる', meaning: '밤', example: '夜に駆ける', translation: '밤을 달리다' },
      ]
    : source.title === 'アイドル'
      ? [
          { id: 9301, japanese: '無敵', reading: 'むてき', meaning: '무적', example: '無敵の笑顔で荒らすメディア', translation: '무적의 미소로 미디어를 뒤흔들어' },
          { id: 9302, japanese: '秘密', reading: 'ひみつ', meaning: '비밀', example: '秘密は蜜の味', translation: '비밀은 꿀맛' },
        ]
      : [
          { id: 9101, japanese: '苦い', reading: 'にがい', meaning: '쓰다, 씁쓸하다', example: '苦いレモンの匂い', translation: '쓴 레몬 향기' },
          { id: 9102, japanese: '匂い', reading: 'におい', meaning: '향기, 냄새', example: 'レモンの匂い', translation: '레몬 향기' },
        ];

  return base.map((card, index) => ({
    id: card.id,
    wordId: card.id,
    japanese: card.japanese,
    reading: card.reading,
    state: 0,
    due: new Date().toISOString(),
    intervals: { 1: '< 1분', 2: '6분', 3: '1일', 4: '4일' },
    senses: [
      {
        meaning: card.meaning,
        partOfSpeech: index === 0 ? '형용사' : '명사',
        jlpt: index === 0 ? 'N3' : 'N5',
        examples: [
          {
            text: card.example,
            translation: card.translation,
            songId: source.songId,
            lineIndex: null,
            songTitle: source.title,
            artworkUrl: source.artworkUrl,
          },
        ],
      },
    ],
    source,
    origin,
  }));
}

export function sourceFromDeck(deck: SongDeckSummary): StudySource {
  return {
    deckId: deck.deckId,
    songId: deck.songId,
    title: deck.title,
    artist: deck.artist,
    artworkUrl: deck.artworkUrl,
    dueCount: deck.dueCount,
    totalCount: deck.wordCount,
  };
}

export function sourceFromRecommendation(item: RecommendedSongItem): StudySource {
  return {
    deckId: null,
    songId: item.songId,
    title: item.title,
    artist: item.artist,
    artworkUrl: item.artworkUrl,
    dueCount: MOCK_RECOMMENDED_SOURCE.dueCount,
    totalCount: MOCK_RECOMMENDED_SOURCE.totalCount,
  };
}
