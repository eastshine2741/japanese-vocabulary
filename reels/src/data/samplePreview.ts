import type {PromoReelData} from '../types';

// Local-only preview fixture for Remotion Studio and sample renders.
// Admin rendering does not read this file; it passes PromoReelData through render props.
export const samplePreviewPromo: PromoReelData = {
  song: {
    title: 'Lemon',
    artist: '米津玄師',
    releaseYear: 2018,
    artworkAsset: 'lemon-cover.jpg',
    mvAsset: 'lemon-chorus.mp4',
  },
  headline: '떠난 뒤에도 남은 레몬 향기',
  instagramHandle: '@kotonoha.music',
  catchphrase: '좋아하는 노래가, 나의 일본어가 되도록.',
  sourceStartFrame: 0,
  lyricLines: [
    {
      startFrame: 0,
      originalText: 'あの日の悲しみさえ あの日の苦しみさえ',
      koreanLyrics: '그날의 슬픔마저 그날의 괴로움마저',
      tokens: [
        {surface: 'あの', baseForm: 'あの', partOfSpeech: 'ADNOMINAL', charStart: 0, charEnd: 2},
        {surface: '日', baseForm: '日', partOfSpeech: 'NOUN', charStart: 2, charEnd: 3},
        {surface: 'の', baseForm: 'の', partOfSpeech: 'PARTICLE', charStart: 3, charEnd: 4},
        {surface: '悲しみ', baseForm: '悲しみ', partOfSpeech: 'NOUN', charStart: 4, charEnd: 7},
        {surface: 'さえ', baseForm: 'さえ', partOfSpeech: 'PARTICLE', charStart: 7, charEnd: 9},
        {surface: ' ', baseForm: ' ', partOfSpeech: 'SYMBOL', charStart: 9, charEnd: 10},
        {surface: 'あの', baseForm: 'あの', partOfSpeech: 'ADNOMINAL', charStart: 10, charEnd: 12},
        {surface: '日', baseForm: '日', partOfSpeech: 'NOUN', charStart: 12, charEnd: 13},
        {surface: 'の', baseForm: 'の', partOfSpeech: 'PARTICLE', charStart: 13, charEnd: 14},
        {surface: '苦しみ', baseForm: '苦しみ', partOfSpeech: 'NOUN', charStart: 14, charEnd: 17},
        {surface: 'さえ', baseForm: 'さえ', partOfSpeech: 'PARTICLE', charStart: 17, charEnd: 19},
      ],
      vocabulary: [
        {japanese: 'あの', reading: 'アノ', korean: '저', partOfSpeech: 'ADNOMINAL', partOfSpeechLabel: '연체사', jlpt: 'N5'},
        {japanese: '日', reading: 'ヒ', korean: '날', partOfSpeech: 'NOUN', partOfSpeechLabel: '명사', jlpt: 'N5'},
      ],
    },
    {
      startFrame: 170,
      originalText: 'そのすべてを愛してた あなたとともに',
      koreanLyrics: '그 모든 것을 사랑했어요 당신과 함께',
      tokens: [
        {surface: 'その', baseForm: 'その', partOfSpeech: 'ADNOMINAL', charStart: 0, charEnd: 2},
        {surface: 'すべて', baseForm: 'すべて', partOfSpeech: 'NOUN', charStart: 2, charEnd: 5},
        {surface: 'を', baseForm: 'を', partOfSpeech: 'PARTICLE', charStart: 5, charEnd: 6},
        {surface: '愛し', baseForm: '愛する', partOfSpeech: 'VERB', charStart: 6, charEnd: 8},
        {surface: 'て', baseForm: 'てる', partOfSpeech: 'AUXILIARY_VERB', charStart: 8, charEnd: 9},
        {surface: 'た', baseForm: 'た', partOfSpeech: 'AUXILIARY_VERB', charStart: 9, charEnd: 10},
        {surface: ' ', baseForm: ' ', partOfSpeech: 'SYMBOL', charStart: 10, charEnd: 11},
        {surface: 'あなた', baseForm: 'あなた', partOfSpeech: 'PRONOUN', charStart: 11, charEnd: 14},
        {surface: 'とともに', baseForm: 'とともに', partOfSpeech: 'PARTICLE', charStart: 14, charEnd: 18},
      ],
      vocabulary: [
        {japanese: 'あなた', reading: 'アナタ', korean: '당신', partOfSpeech: 'PRONOUN', partOfSpeechLabel: '대명사', jlpt: 'N5'},
        {japanese: 'すべて', reading: 'スベテ', korean: '전부', partOfSpeech: 'NOUN', partOfSpeechLabel: '명사', jlpt: 'N4'},
      ],
    },
    {
      startFrame: 332,
      originalText: '胸に残り離れない 苦いレモンの匂い',
      koreanLyrics: '가슴에 남아 떠나지 않는 씁쓸한 레몬 향기',
      tokens: [
        {surface: '胸', baseForm: '胸', partOfSpeech: 'NOUN', charStart: 0, charEnd: 1},
        {surface: 'に', baseForm: 'に', partOfSpeech: 'PARTICLE', charStart: 1, charEnd: 2},
        {surface: '残り', baseForm: '残る', partOfSpeech: 'VERB', charStart: 2, charEnd: 4},
        {surface: '離れ', baseForm: '離れる', partOfSpeech: 'VERB', charStart: 4, charEnd: 6},
        {surface: 'ない', baseForm: 'ない', partOfSpeech: 'AUXILIARY_VERB', charStart: 6, charEnd: 8},
        {surface: ' ', baseForm: ' ', partOfSpeech: 'SYMBOL', charStart: 8, charEnd: 9},
        {surface: '苦い', baseForm: '苦い', partOfSpeech: 'ADJECTIVE', charStart: 9, charEnd: 11},
        {surface: 'レモン', baseForm: 'レモン', partOfSpeech: 'NOUN', charStart: 11, charEnd: 14},
        {surface: 'の', baseForm: 'の', partOfSpeech: 'PARTICLE', charStart: 14, charEnd: 15},
        {surface: '匂い', baseForm: '匂い', partOfSpeech: 'NOUN', charStart: 15, charEnd: 17},
      ],
      vocabulary: [
        {japanese: '苦い', reading: 'ニガイ', korean: '쓰다', partOfSpeech: 'ADJECTIVE', partOfSpeechLabel: '형용사', jlpt: 'N3'},
        {japanese: '匂い', reading: 'ニオイ', korean: '냄새, 향기', partOfSpeech: 'NOUN', partOfSpeechLabel: '명사', jlpt: 'N4'},
      ],
    },
    {
      startFrame: 507,
      originalText: '雨が降り止むまでは帰れない',
      koreanLyrics: '비가 그칠 때까지는 돌아갈 수 없어요',
      tokens: [
        {surface: '雨', baseForm: '雨', partOfSpeech: 'NOUN', charStart: 0, charEnd: 1},
        {surface: 'が', baseForm: 'が', partOfSpeech: 'PARTICLE', charStart: 1, charEnd: 2},
        {surface: '降り止む', baseForm: '降り止む', partOfSpeech: 'VERB', charStart: 2, charEnd: 6},
        {surface: 'まで', baseForm: 'まで', partOfSpeech: 'PARTICLE', charStart: 6, charEnd: 8},
        {surface: 'は', baseForm: 'は', partOfSpeech: 'PARTICLE', charStart: 8, charEnd: 9},
        {surface: '帰れ', baseForm: '帰れる', partOfSpeech: 'VERB', charStart: 9, charEnd: 11},
        {surface: 'ない', baseForm: 'ない', partOfSpeech: 'AUXILIARY_VERB', charStart: 11, charEnd: 13},
      ],
      vocabulary: [
        {japanese: '雨', reading: 'アメ', korean: '비', partOfSpeech: 'NOUN', partOfSpeechLabel: '명사', jlpt: 'N5'},
        {japanese: '帰る', reading: 'カエル', korean: '돌아가다', partOfSpeech: 'VERB', partOfSpeechLabel: '동사', jlpt: 'N4'},
      ],
    },
    {
      startFrame: 676,
      originalText: '今でもあなたはわたしの光',
      koreanLyrics: '지금도 당신은 나의 빛이에요',
      tokens: [
        {surface: '今', baseForm: '今', partOfSpeech: 'NOUN', charStart: 0, charEnd: 1},
        {surface: 'でも', baseForm: 'でも', partOfSpeech: 'PARTICLE', charStart: 1, charEnd: 3},
        {surface: 'あなた', baseForm: 'あなた', partOfSpeech: 'PRONOUN', charStart: 3, charEnd: 6},
        {surface: 'は', baseForm: 'は', partOfSpeech: 'PARTICLE', charStart: 6, charEnd: 7},
        {surface: 'わたし', baseForm: 'わたし', partOfSpeech: 'PRONOUN', charStart: 7, charEnd: 10},
        {surface: 'の', baseForm: 'の', partOfSpeech: 'PARTICLE', charStart: 10, charEnd: 11},
        {surface: '光', baseForm: '光', partOfSpeech: 'NOUN', charStart: 11, charEnd: 12},
      ],
      vocabulary: [
        {japanese: '今', reading: 'イマ', korean: '지금', partOfSpeech: 'NOUN', partOfSpeechLabel: '명사', jlpt: 'N5'},
        {japanese: '光', reading: 'ヒカリ', korean: '빛', partOfSpeech: 'NOUN', partOfSpeechLabel: '명사', jlpt: 'N4'},
      ],
    },
  ],
  wordCount: 9,
};
