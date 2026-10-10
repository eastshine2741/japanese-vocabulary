import type { CardLyricLine, CardWord } from '../rewardCards/types';
import { MAX_LYRIC_LINES } from '../rewardCards/cardLyric';
import type { SongLyricLineDto } from '../../types/song';
import { katakanaToHiragana } from '../../utils/readingConverter';
import { buildTokenCells } from './songLyricsDial';
import type { SongDetailWordItem } from './types';

const SAMPLE_WORD_COUNT = 5;

export function toCardLine(line: SongLyricLineDto): CardLyricLine {
  return {
    index: line.index,
    ruby: buildTokenCells(line, []).map(cell => ({ text: cell.text, reading: cell.furigana ?? undefined })),
    ko: line.koreanLyrics ?? '',
  };
}

/**
 * 견본 카드에 실을 가사. 주인이 고르기 전이라 가장 많이 반복되는 줄(대개 후렴)과 그 다음 줄을 쓴다.
 * 번역이 없거나 분석되지 않은 줄은 뒷면 후리가나·번역이 비어 건너뛴다.
 */
export function pickSampleLyric(lines: readonly SongLyricLineDto[]): CardLyricLine[] {
  const usable = lines.filter(line => line.originalText.trim() !== '' && (line.tokens?.length ?? 0) > 0 && line.koreanLyrics);
  if (usable.length === 0) return [];
  const counts = new Map<string, number>();
  for (const line of usable) counts.set(line.originalText, (counts.get(line.originalText) ?? 0) + 1);
  const first = usable.reduce((best, line) => (counts.get(line.originalText)! > counts.get(best.originalText)! ? line : best));
  const picked = [first];
  const next = usable.find(line => line.index > first.index && line.originalText !== first.originalText);
  if (next && picked.length < MAX_LYRIC_LINES) picked.push(next);
  return picked.map(toCardLine);
}

/** 견본 카드 뒷면 단어. 곡에서 중요한 단어부터. */
export function pickSampleWords(words: readonly SongDetailWordItem[]): CardWord[] {
  return words
    .filter(word => word.koreanText)
    .slice()
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, SAMPLE_WORD_COUNT)
    .map(word => ({
      japanese: word.japanese,
      reading: katakanaToHiragana(word.reading ?? ''),
      meaning: word.senses?.[0]?.meaning ?? word.koreanText ?? '',
    }));
}
