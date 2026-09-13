export type PartOfSpeech =
  | 'NOUN'
  | 'VERB'
  | 'ADJECTIVE'
  | 'NA_ADJECTIVE'
  | 'ADVERB'
  | 'PARTICLE'
  | 'PRONOUN'
  | 'ADNOMINAL'
  | 'CONJUNCTION'
  | 'AUXILIARY_VERB'
  | 'INTERJECTION'
  | 'PREFIX'
  | 'SUFFIX'
  | 'EXPRESSION'
  | 'FILLER'
  | 'OTHER'
  | 'SYMBOL'
  | 'SUPPLEMENTARY_SYMBOL'
  | 'WHITESPACE';

export type LyricToken = {
  surface: string;
  baseForm: string;
  reading?: string | null;
  baseFormReading?: string | null;
  partOfSpeech: PartOfSpeech;
  charStart: number;
  charEnd: number;
  koreanText?: string | null;
  jlpt?: string | null;
};

export type VocabularyWord = {
  japanese: string;
  reading: string;
  korean: string;
  partOfSpeech?: PartOfSpeech | string | null;
  partOfSpeechLabel?: string | null;
  jlpt?: string | null;
};

export type PromoLine = {
  startFrame: number;
  /** 곡 안에서 몇 번째 줄인지(1-based). 엔드카드 앱 목업의 페이지 표시용. */
  lineNumber?: number;
  originalText: string;
  koreanLyrics: string;
  tokens: LyricToken[];
  vocabulary: VocabularyWord[];
};

export type PromoReelData = {
  song: {
    title: string;
    artist: string;
    releaseYear?: number;
    artworkAsset: string;
    mvAsset: string;
  };
  headline: string;
  instagramHandle: string;
  catchphrase: string;
  sourceStartFrame: number;
  /** 마지막 선택 줄이 끝나는 프레임. 이 프레임부터 엔드카드가 뜬다. */
  lyricsEndFrame: number;
  /** 곡 전체 가사 줄 수. 엔드카드 앱 목업의 "n/전체" 표시용. */
  totalLineCount?: number;
  wordCount?: number;
  lyricLines: PromoLine[];
};
