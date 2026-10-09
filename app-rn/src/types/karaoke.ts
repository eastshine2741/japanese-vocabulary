/** 노래방 신곡 한 줄. 같은 곡이 두 노래방에 올랐으면 번호가 둘 다 있다. */
export interface KaraokeSongItem {
  title: string;
  artist: string;
  artworkUrl: string | null;
  tjNumber: number | null;
  kyNumber: number | null;
  /** 분석이 끝난 곡만 있다. 없으면 곡 상세로 들어갈 수 없다. */
  songId: number | null;
}

export interface KaraokeDailyGroup {
  /** YYYY-MM-DD */
  listedOn: string;
  songs: KaraokeSongItem[];
}

export interface KaraokeArtistGroup {
  artist: string;
  songs: KaraokeSongItem[];
}

export interface KaraokeMonthly {
  /** YYYY-MM */
  month: string;
  songCount: number;
  artists: KaraokeArtistGroup[];
}
