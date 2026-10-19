import { SongSearchItem } from './song';

/** 이해도는 곡 상세와 같은 계산이다 (`GET /api/songs/{id}/coverage`). */
export interface ArtistStudyingSong {
  songId: number;
  title: string;
  artworkUrl: string | null;
  totalLines: number;
  knownLines: number;
}

export interface ArtistDetail {
  id: number;
  name: string;
  artworkUrl: string | null;
  appleMusicUrl: string | null;
  /** 곡 단어장을 가진 곡. 이해도 높은 순. */
  studyingSongs: ArtistStudyingSong[];
  /** 아직 분석되지 않은 인기곡. 검색 결과와 같은 모양이라 탭하면 검색 결과와 같은 흐름을 탄다. */
  popularSongs: SongSearchItem[];
}
