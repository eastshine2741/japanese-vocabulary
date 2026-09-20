import { describe, expect, it } from 'vitest';
import type { SongWordStageDto } from '../../types/song';
import { resolveStageStatuses, selectCurrentStage } from './songDetailWordDerivation';

function stage(order: number, totalCount: number, knownCount: number): SongWordStageDto {
  return {
    key: (['CORE', 'STARTER', 'BASIC', 'ADVANCED'] as const)[order - 1],
    order,
    name: `s${order}`,
    description: '',
    wordJapanese: [],
    totalCount,
    knownCount,
    learningCount: 0,
  };
}

describe('stage statuses', () => {
  it('marks the first unfinished stage as current', () => {
    const stages = [stage(1, 10, 10), stage(2, 17, 10), stage(3, 19, 0), stage(4, 58, 0)];
    expect(resolveStageStatuses(stages)).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(selectCurrentStage(stages)?.order).toBe(2);
  });

  it('has no current stage when everything is known', () => {
    const stages = [stage(1, 10, 10), stage(2, 5, 5)];
    expect(resolveStageStatuses(stages)).toEqual(['done', 'done']);
    expect(selectCurrentStage(stages)).toBeNull();
  });

  it('skips an empty stage so the next one becomes current', () => {
    const stages = [stage(1, 0, 0), stage(2, 3, 0)];
    expect(resolveStageStatuses(stages)).toEqual(['done', 'current']);
  });
});
