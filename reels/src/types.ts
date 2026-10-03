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

/**
 * 릴스 전체에 고정되는 MV 배치. 1080×1920 캔버스 기준이다.
 * scale 은 (잘라낸) MV 폭 ÷ 릴스 폭(1 = 폭에 딱 맞음, 높이는 MV 비율대로), x/y 는 캔버스 가운데에서 MV 중심을 옮기는 px 이다.
 * MV 가 캔버스를 다 덮지 못하면 빈 곳은 같은 MV 를 블러해서 채운다.
 */
export type MvFrame = {
  scale: number;
  x: number;
  y: number;
  /** MV 원본에서 잘라낼 비율(0..1, 각 변 기준). MV 에 박힌 검은 여백을 떼는 용도. scale·x·y 는 잘라낸 뒤 영역 기준이다. */
  crop?: MvCrop | null;
};

export type MvCrop = {
  top: number;
  right: number;
  bottom: number;
  left: number;
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
  /** 없으면 캔버스를 꽉 채운다(cover). */
  mvFrame?: MvFrame | null;
  /** 마지막 선택 줄이 끝나는 프레임. 이 프레임부터 엔드카드가 뜬다. */
  lyricsEndFrame: number;
  /** 곡 전체 가사 줄 수. 엔드카드 앱 목업의 "n/전체" 표시용. */
  totalLineCount?: number;
  wordCount?: number;
  lyricLines: PromoLine[];
};
