export interface WordDefinitionDTO {
  japanese: string;
  reading: string;
  meanings: string[];
  partsOfSpeech: string[];
  jlptLevel: string | null;
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
  koreanText: string | null;
  examples: ExampleSentence[];
}

export interface WordListItem {
  id: number;
  japanese: string;
  reading: string;
  koreanText: string;
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
  songId: number;
  lyricLine: string;
}
