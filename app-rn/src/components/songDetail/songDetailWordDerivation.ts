import { Colors } from '../../theme/theme';
import {
  SongDetailJlptBucket,
  SongDetailJlptLevel,
  SongDetailJlptSlice,
  SongDetailWordItem,
} from './types';

export const MAJOR_WORD_LIMIT = 5;

export const JLPT_LEVELS: SongDetailJlptLevel[] = ['N1', 'N2', 'N3', 'N4', 'N5'];
export const JLPT_LEGEND_ORDER: SongDetailJlptBucket[] = ['N5', 'N4', 'N3', 'N2', 'N1', 'UNKNOWN'];

export const JLPT_COLORS: Record<SongDetailJlptBucket, string> = {
  N1: Colors.jlptN1,
  N2: Colors.jlptN2,
  N3: Colors.jlptN3,
  N4: Colors.jlptN4,
  N5: Colors.jlptN5,
  UNKNOWN: Colors.border,
};

const JLPT_LABELS: Record<SongDetailJlptBucket, string> = {
  N1: 'N1',
  N2: 'N2',
  N3: 'N3',
  N4: 'N4',
  N5: 'N5',
  UNKNOWN: '알 수 없음',
};

function normalizeJlpt(jlpt: SongDetailWordItem['jlpt']): SongDetailJlptBucket {
  return JLPT_LEVELS.includes(jlpt as SongDetailJlptLevel)
    ? (jlpt as SongDetailJlptLevel)
    : 'UNKNOWN';
}

export function selectMajorWords(words: readonly SongDetailWordItem[]): SongDetailWordItem[] {
  return [...words]
    .sort((a, b) => {
      const importanceDiff = b.importanceScore - a.importanceScore;
      if (importanceDiff !== 0) return importanceDiff;

      const orderDiff = a.appearanceOrder - b.appearanceOrder;
      if (orderDiff !== 0) return orderDiff;

      return a.japanese.localeCompare(b.japanese, 'ja');
    })
    .slice(0, MAJOR_WORD_LIMIT);
}

export function buildJlptDistribution(words: readonly SongDetailWordItem[]): SongDetailJlptSlice[] {
  const counts: Record<SongDetailJlptBucket, number> = {
    N1: 0,
    N2: 0,
    N3: 0,
    N4: 0,
    N5: 0,
    UNKNOWN: 0,
  };

  for (const word of words) {
    counts[normalizeJlpt(word.jlpt)] += 1;
  }

  const total = words.length;
  return JLPT_LEGEND_ORDER.map(key => ({
    key,
    label: JLPT_LABELS[key],
    count: counts[key],
    percent: total > 0 ? Math.round((counts[key] / total) * 100) : 0,
    color: JLPT_COLORS[key],
  }));
}
