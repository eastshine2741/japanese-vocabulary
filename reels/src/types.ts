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
  | 'FILLER'
  | 'OTHER'
  | 'SYMBOL'
  | 'SUPPLEMENTARY_SYMBOL'
  | 'WHITESPACE';

export type LyricToken = {
  surface: string;
  baseForm: string;
  partOfSpeech: PartOfSpeech;
  charStart: number;
  charEnd: number;
};

export type VocabularyWord = {
  japanese: string;
  reading: string;
  korean: string;
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
  lyricLines: PromoLine[];
};
