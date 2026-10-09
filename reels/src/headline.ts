/**
 * 릴스 헤드라인 표기. 어드민이 직접 쓰는 한 덩어리 문자열이고 규칙은 둘뿐이다.
 * - 줄바꿈이 줄을 나눈다.
 * - `<b>…</b>` 로 감싼 구간에만 초록 배경이 깔린다.
 */

export type HeadlineSegment = {
  text: string;
  /** 초록 배경을 깔 구간. 어드민이 `<b>` 로 감싼 자리다. */
  highlight: boolean;
};

const HIGHLIGHT = /<b>([\s\S]*?)<\/b>/gi;

/** 헤드라인을 줄 → 조각으로 펼친다. 빈 줄은 버린다. */
export const parseHeadline = (headline: string): HeadlineSegment[][] =>
  headline
    .split('\n')
    .map((line) => lineSegments(line.trim()))
    .filter((segments) => segments.length > 0);

const lineSegments = (line: string): HeadlineSegment[] => {
  const segments: HeadlineSegment[] = [];
  let at = 0;
  for (const match of line.matchAll(HIGHLIGHT)) {
    push(segments, line.slice(at, match.index), false);
    push(segments, match[1], true);
    at = match.index + match[0].length;
  }
  push(segments, line.slice(at), false);
  return segments;
};

const push = (segments: HeadlineSegment[], text: string, highlight: boolean) => {
  // 닫지 않은 `<b>` 나 빈 `<b></b>` 는 조각을 만들지 않고 흘려보낸다.
  if (text !== '') segments.push({text, highlight});
};
