import { useMemo } from 'react';

export interface TimedLyricLine {
  index: number;
  startTimeMs: number | null;
}

export function getCurrentLyricLineIndex(
  lines: TimedLyricLine[],
  currentTimeMs: number,
  fallbackIndex = 0,
): number {
  if (lines.length === 0) return -1;

  let currentIndex = Math.min(Math.max(fallbackIndex, 0), lines.length - 1);
  for (let i = 0; i < lines.length; i += 1) {
    const startTimeMs = lines[i].startTimeMs;
    if (startTimeMs == null) continue;
    if (startTimeMs <= currentTimeMs) {
      currentIndex = i;
    } else {
      break;
    }
  }

  return currentIndex;
}

export function useCurrentLyricLine<T extends TimedLyricLine>(
  lines: T[],
  currentTimeMs: number,
  fallbackIndex = 0,
): T | null {
  const currentIndex = useMemo(
    () => getCurrentLyricLineIndex(lines, currentTimeMs, fallbackIndex),
    [lines, currentTimeMs, fallbackIndex],
  );

  return currentIndex >= 0 ? lines[currentIndex] : null;
}
