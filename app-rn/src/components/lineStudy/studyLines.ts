import type { SongLyricLineDto, SongWordTierDto, WordInSongItemDto } from '../../types/song';

/** 다음 줄 시각을 모르는 마지막 줄은 이만큼만 튼다. */
const LAST_LINE_CLIP_MS = 8000;

export interface StudyLine {
  line: SongLyricLineDto;
  /** 이 줄의 tier 단어, 줄 안 등장순. */
  words: WordInSongItemDto[];
  /** 아직 한 번도 안 본 단어 수. 0 이면 열린 줄이다. */
  unseenCount: number;
  clipStartMs: number | null;
  clipEndMs: number | null;
}

/**
 * 한 번이라도 리뷰한 단어가 본 단어다. 줄 학습 세션이 '처음 보는 단어'(REMAINING)만 묻기 때문에 같은 기준이어야
 * 'N개 풀기' 버튼과 세션 장수가 맞는다. 담기만 하고 안 본 단어는 안 본 단어다. 구버전 서버는 담김 여부로 대신한다.
 */
export function isWordSeen(word: WordInSongItemDto): boolean {
  return word.isStudied ?? (word.isSavedForSong || word.isSavedGlobally);
}

/** 단계 카드의 `japanese` 는 저장 키이거나 단어 표기라 둘 다 싣는다. */
export function lineWordKeys(line: StudyLine): string[] {
  return [...new Set(line.words.flatMap(word => [word.addRequest.japanese, word.japanese]))];
}

/**
 * 빈 줄을 뺀 가사를 순서대로 고른다. 단어는 이해도와 같은 tier 단어(단계에 든 단어)만 센다 —
 * 감동사·뜻 없는 단어까지 세면 영원히 안 열리는 줄이 생긴다. 풀 단어가 없는 줄은 처음부터 열린 줄이라 멈추지 않고 흘러간다.
 */
export function buildStudyLines(
  lines: readonly SongLyricLineDto[],
  words: readonly WordInSongItemDto[],
  lineWordIndexes: Record<string, number[]>,
  tiers: readonly SongWordTierDto[],
): StudyLine[] {
  const tierWords = new Set(tiers.flatMap(tier => tier.wordJapanese));
  const result: StudyLine[] = [];
  lines.forEach((line, position) => {
    if (line.originalText.trim() === '') return;
    const lineWords: WordInSongItemDto[] = [];
    for (const wordIndex of lineWordIndexes[String(line.index)] ?? []) {
      const word = words[wordIndex];
      if (word == null || !tierWords.has(word.japanese)) continue;
      if (lineWords.some(other => other.japanese === word.japanese)) continue;
      lineWords.push(word);
    }
    const clipStartMs = line.startTimeMs;
    const nextStartMs = lines
      .slice(position + 1)
      .find(next => next.startTimeMs != null && clipStartMs != null && next.startTimeMs > clipStartMs)
      ?.startTimeMs ?? null;
    result.push({
      line,
      words: lineWords,
      unseenCount: lineWords.filter(word => !isWordSeen(word)).length,
      clipStartMs,
      clipEndMs: clipStartMs == null ? null : nextStartMs ?? clipStartMs + LAST_LINE_CLIP_MS,
    });
  });
  return result;
}

/** 처음 들어오면 아직 안 열린 첫 줄부터. 다 열렸으면 첫 줄. */
export function firstLockedPosition(studyLines: readonly StudyLine[]): number {
  const position = studyLines.findIndex(line => line.unseenCount > 0);
  return position < 0 ? 0 : position;
}

/** 이보다 빠르게 튕기면 손 뗀 자리가 같은 줄이어도 한 줄 넘긴다. */
const FLICK_VELOCITY = 500;

/**
 * 손을 뗀 자리에서 지금 줄 자리에 가장 가까운 줄로 앉힌다. 관성으로 굴러가지 않고 줄 단위로만 멈춘다.
 * 아직 안 온 줄([maxIndex] 너머)로는 가지 않는다.
 */
export function snapLineIndex(
  lineTops: readonly number[],
  offsetY: number,
  focusTop: number,
  startIndex: number,
  velocityY: number,
  maxIndex: number,
): number {
  'worklet';
  let nearest = startIndex;
  let nearestDistance = Infinity;
  for (let i = 0; i <= maxIndex && i < lineTops.length; i += 1) {
    const distance = Math.abs(lineTops[i] + offsetY - focusTop);
    if (distance < nearestDistance) {
      nearest = i;
      nearestDistance = distance;
    }
  }
  if (nearest === startIndex && Math.abs(velocityY) > FLICK_VELOCITY) {
    // 아래로 튕기면(양수) 지나온 줄로 간다.
    nearest = startIndex + (velocityY > 0 ? -1 : 1);
  }
  return Math.max(0, Math.min(maxIndex, nearest));
}
