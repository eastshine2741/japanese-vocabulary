import { ArtistRewardCard, CardLevel, CardLyricLine, CardWord, SongRewardCard } from './types';

const PREVIEW_ACCENT = '#C9C3D6';
const PREVIEW_INK = '#15121C';

export interface PreviewSong {
  id: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
  /** 주인이 고르기 전이라 곡에서 대표 줄을 골라 싣는다. */
  lyric: CardLyricLine[];
  words: CardWord[];
}

/** 아직 얻지 않은 레벨이 어떤 모습인지 보여 주는 견본. 서명·획득 순번·획득일은 주인 것이라 비운다. */
export function songCardPreview(song: PreviewSong, level: CardLevel, mastered: boolean): SongRewardCard {
  return {
    id: `preview-song-${song.id}-${mastered ? 'master' : level}`,
    songId: song.id,
    title: song.title,
    artist: song.artist,
    artworkUrl: song.artworkUrl ?? '',
    accent: PREVIEW_ACCENT,
    ink: PREVIEW_INK,
    level,
    mastered,
    reviewedCount: 0,
    dueCount: 0,
    ownerNo: 1,
    earnedAt: '',
    lyric: song.lyric,
    signature: null,
    words: song.words,
    goals: {},
    sample: true,
  };
}

export interface PreviewArtist {
  id: number;
  name: string;
  artworkUrl: string | null;
}

export type CardPreviewTarget =
  | { kind: 'song'; song: PreviewSong; level: CardLevel; mastered: boolean }
  | { kind: 'artist'; artist: PreviewArtist; masteredCount: number };

export function artistCardPreview(artist: PreviewArtist, masteredCount: number): ArtistRewardCard {
  return {
    id: `preview-artist-${artist.id}-${masteredCount}`,
    artistId: artist.id,
    name: artist.name,
    imageUrl: artist.artworkUrl ?? '',
    accent: PREVIEW_ACCENT,
    ink: PREVIEW_INK,
    masteredCount,
    ownerNo: 1,
    fanNo: masteredCount >= 1 ? 1 : null,
    since: new Date().toISOString().slice(0, 10),
    masteredSongs: [],
    signature: null,
    sample: true,
  };
}
