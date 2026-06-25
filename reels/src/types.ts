export type PartOfSpeech =
  | 'NOUN'
  | 'VERB'
  | 'ADJECTIVE'
  | 'NA_ADJECTIVE'
  | 'ADVERB'
  | 'PARTICLE'
  | 'PRONOUN'
  | 'ADNOMINAL'
  | 'AUXILIARY_VERB'
  | 'SYMBOL';

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
  lyricLines: PromoLine[];
};
