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
  wordCount?: number;
  lyricLines: PromoLine[];
};
