import { describe, expect, it } from 'vitest';
import { flattenExamplesForSong, SenseExample, WordSense } from './word';

const ex = (text: string, songId: number | null): SenseExample => ({ text, translation: null, songId, lineIndex: 0 });

const senses: WordSense[] = [
  { meaning: 'a', partOfSpeech: 'noun', examples: [ex('1', 10), ex('2', 20)] },
  { meaning: 'b', partOfSpeech: 'noun', examples: [ex('3', null), ex('4', 20)] },
];

describe('flattenExamplesForSong', () => {
  it('학습 중인 곡의 예문을 앞에 두고 나머지 순서는 지킨다', () => {
    expect(flattenExamplesForSong(senses, 20).map(e => e.text)).toEqual(['2', '4', '1', '3']);
  });

  it('곡이 없으면 원래 순서 그대로', () => {
    expect(flattenExamplesForSong(senses, null).map(e => e.text)).toEqual(['1', '2', '3', '4']);
  });
});
