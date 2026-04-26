import { ExampleSentence, WordMeaning } from './word';

export interface FlashcardDTO {
  id: number;
  wordId: number;
  japanese: string;
  reading: string | null;
  meanings: WordMeaning[];
  examples: ExampleSentence[];
  state: number; // 0=NEW, 1=LEARNING, 2=REVIEW, 3=RELEARNING
  due: string;
  intervals: Record<number, string> | null; // rating -> interval string
}

export interface DueFlashcardsResponse {
  cards: FlashcardDTO[];
  totalCount: number;
}

export interface FlashcardStatsResponse {
  total: number;
  due: number;
  newCount: number;
  learning: number;
  review: number;
}

export interface ReviewRequest {
  rating: number;
}

export interface ReviewResponse {
  id: number;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
}

export interface UserSettingsDTO {
  requestRetention: number;
  showIntervals: boolean;
  readingDisplay: 'KATAKANA' | 'HIRAGANA' | 'KOREAN';
  showKoreanPronunciation: boolean;
  showFurigana: boolean;
  dailyGoal: number;
}
