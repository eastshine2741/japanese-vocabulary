export interface WordMeaning {
  text: string;
  partOfSpeech: string;
}

export interface ExampleSentence {
  songId: number;
  songTitle: string | null;
  lyricLine: string | null;
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
}
