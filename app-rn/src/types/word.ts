export interface WordMeaning {
  text: string;
  partOfSpeech: string;
}

export interface ExampleSentence {
  id: number;
  songId: number;
  songTitle: string | null;
  lyricLine: string | null;
  koreanLyricLine: string | null;
  artworkUrl: string | null;
}

export interface WordDetailResponse {
  id: number;
  japanese: string;
  reading: string | null;
  meanings: WordMeaning[];
  examples: ExampleSentence[];
}

export interface WordListItem {
  id: number;
  japanese: string;
  reading: string;
  meanings: WordMeaning[];
  examples: ExampleSentence[];
}

export interface WordListResponse {
  words: WordListItem[];
  nextCursor: number | null;
}

export interface AddWordRequest {
  japanese: string;
  reading: string;
  koreanText: string;
  partOfSpeech: string;
  songId: number;
  lyricLine: string;
  koreanLyricLine?: string;
}

export interface BatchAddWordRequest {
  words: AddWordRequest[];
}

export interface BatchAddWordResponse {
  savedCount: number;
  skippedCount: number;
}

export interface UpdateWordRequest {
  reading: string | null;
  meanings: WordMeaning[];
  resetFlashcard?: boolean;
  deleteExampleIds?: number[];
}
