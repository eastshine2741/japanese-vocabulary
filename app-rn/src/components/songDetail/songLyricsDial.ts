import { getPosColor } from '../../types/pos';
import { Token } from '../../types/song';
import { katakanaToHiragana } from '../../utils/readingConverter';
import type { CurrentPlayingLyricLine, CurrentPlayingWord } from './CurrentPlayingWordsSheet';

/** 줄과 줄 사이. 포커스 띠는 이 간격을 덮지 않는다. */
export const LINE_GAP = 22;
/** 아직 재보지 않은 줄의 임시 높이. */
export const DEFAULT_LINE_HEIGHT = 48;
/** 한 줄을 넘기는 데 필요한 드래그 거리. 안 눌린 줄의 간격(≈48)에 맞춰 잡았다. */
export const DRAG_STEP = 56;

const KANJI_RE = /[一-鿿]/;
/** 색 띠를 두르지 않는 품사 — 조사·기호는 학습 대상이 아니다. */
const MUTED_POS = new Set(['PARTICLE', 'SYMBOL', 'SUPPLEMENTARY_SYMBOL', 'WHITESPACE']);

export interface TokenCell {
  key: string;
  text: string;
  furigana: string | null;
  meaning: string | null;
  /** null 이면 띠를 그리지 않는다 — 분석되지 않은 글자이거나 학습 대상이 아닌 품사. */
  barColor: string | null;
  word: CurrentPlayingWord | null;
}

export interface SlotLayout {
  top: number;
  height: number;
}

export function getTokenBarColor(partOfSpeech: string | null | undefined): string | null {
  if (!partOfSpeech || MUTED_POS.has(partOfSpeech)) return null;
  return getPosColor(partOfSpeech);
}

function findTokenWord(token: Token, words: CurrentPlayingWord[]): CurrentPlayingWord | null {
  return words.find(word => word.surface === token.surface)
    ?? words.find(word => (word.baseForm ?? word.japanese) === token.baseForm)
    ?? null;
}

function tokenMeaning(token: Token, word: CurrentPlayingWord | null): string | null {
  return token.koreanText ?? word?.senses?.[0]?.meaning ?? word?.koreanText ?? null;
}

function plainCell(text: string, key: string): TokenCell | null {
  if (text === '') return null;
  return { key, text, furigana: null, meaning: null, barColor: null, word: null };
}

/** 토큰 사이에 분석되지 않은 글자가 있어도 원문 순서를 잃지 않게 메워 가며 자른다. */
export function buildTokenCells(
  line: CurrentPlayingLyricLine,
  words: CurrentPlayingWord[],
): TokenCell[] {
  const text = line.originalText;
  const tokens = line.tokens ?? [];
  if (tokens.length === 0) return [];

  const cells: TokenCell[] = [];
  let cursor = 0;

  tokens
    .slice()
    .sort((a, b) => a.charStart - b.charStart)
    .forEach((token, index) => {
      if (token.charStart > cursor) {
        const gap = plainCell(text.slice(cursor, token.charStart), `gap-${index}`);
        if (gap) cells.push(gap);
      }

      const surface = text.slice(token.charStart, token.charEnd) || token.surface;
      const word = findTokenWord(token, words);
      cells.push({
        key: `token-${index}-${token.charStart}`,
        text: surface,
        furigana: token.reading && KANJI_RE.test(surface) ? katakanaToHiragana(token.reading) : null,
        meaning: tokenMeaning(token, word),
        barColor: getTokenBarColor(token.partOfSpeech),
        word,
      });
      cursor = Math.max(cursor, token.charEnd);
    });

  if (cursor < text.length) {
    const tail = plainCell(text.slice(cursor), 'tail');
    if (tail) cells.push(tail);
  }

  return cells;
}

/**
 * 줄마다 잰 높이를 쌓아 슬롯 자리를 만든다. 줄 간격을 top 에 더해 두므로, 줄바꿈된
 * 가사가 아무 데서나 나와도 옆 슬롯이나 포커스 띠를 침범하지 않는다.
 */
export function buildSlotLayouts(
  lineCount: number,
  lineHeights: Record<number, number>,
): SlotLayout[] {
  const out: SlotLayout[] = [];
  let y = 0;
  for (let i = 0; i < lineCount; i += 1) {
    const height = lineHeights[i] ?? DEFAULT_LINE_HEIGHT;
    out.push({ top: y, height });
    y += height + LINE_GAP;
  }
  return out;
}

/** 위로 끌면(음수) 다음 줄로 간다. 가사 양 끝을 넘어가지는 않는다. */
export function stepTargetIndex(
  safeIndex: number,
  translationY: number,
  lineCount: number,
): number {
  'worklet';
  const delta = -Math.round(translationY / DRAG_STEP);
  return Math.max(0, Math.min(lineCount - 1, safeIndex + delta));
}
