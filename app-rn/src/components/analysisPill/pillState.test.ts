import { describe, expect, it } from 'vitest';
import { AnalysisJob, derivePillState, deriveJobPillState, failureReason, PILL_TITLE, STUDY_HINT_NOTE } from './pillState';

const job = (over: Partial<AnalysisJob>): AnalysisJob => ({
  workId: 1,
  title: '夜に駆ける',
  artist: 'YOASOBI',
  artworkUrl: 'a.jpg',
  songId: null,
  phase: 'analyzing',
  settledAt: null,
  errorCode: null,
  ...over,
});

describe('derivePillState', () => {
  it('is hidden with no jobs', () => {
    expect(derivePillState([])).toBeNull();
  });

  it('single analyzing song taps straight into the song once lyrics are ready', () => {
    expect(derivePillState([job({})])).toMatchObject({
      tone: 'analyzing',
      title: PILL_TITLE.analyzing,
      song: '夜に駆ける',
      note: null,
      expandable: false,
      tapSongId: null,
    });
    expect(derivePillState([job({ songId: 7 })])?.tapSongId).toBe(7);
  });

  it('two analyzing songs name the first and count the rest, and expand on tap', () => {
    const state = derivePillState([job({}), job({ workId: 2, title: '怪物', artworkUrl: 'b.jpg' })]);
    expect(state).toMatchObject({
      tone: 'analyzing',
      song: '夜に駆ける',
      note: ' 외 1곡',
      arts: ['a.jpg', 'b.jpg'],
      expandable: true,
      tapSongId: null,
    });
  });

  it('all done with several songs names the latest and counts the rest', () => {
    const state = derivePillState([
      job({ workId: 1, title: 'Lemon', songId: 3, phase: 'done', settledAt: 10 }),
      job({ workId: 2, title: '怪物', songId: 4, phase: 'done', settledAt: 20 }),
      job({ workId: 3, title: 'アイドル', songId: 5, phase: 'done', settledAt: 30 }),
    ]);
    expect(state?.song).toBe('アイドル');
    expect(state?.note).toBe(' 외 2곡');
  });

  it('single done song hints that a tap starts studying and opens it', () => {
    const state = derivePillState([job({ title: 'Lemon', songId: 3, phase: 'done', settledAt: 10 })]);
    expect(state).toMatchObject({
      tone: 'done',
      title: PILL_TITLE.done,
      song: 'Lemon',
      note: STUDY_HINT_NOTE,
      expandable: false,
      tapSongId: 3,
      studyHint: true,
    });
  });

  it('several done songs keep the count note and expand instead of hinting', () => {
    const state = derivePillState([
      job({ workId: 1, title: 'Lemon', songId: 3, phase: 'done', settledAt: 10 }),
      job({ workId: 2, title: '怪物', songId: 4, phase: 'done', settledAt: 20 }),
    ]);
    expect(state).toMatchObject({ song: '怪物', note: ' 외 1곡', expandable: true, studyHint: false });
  });

  it('done + analyzing shows only the remaining count', () => {
    const state = derivePillState([
      job({ workId: 1, title: '夜に駆ける' }),
      job({ workId: 2, title: 'Lemon', artworkUrl: 'l.jpg', songId: 3, phase: 'done', settledAt: 10 }),
      job({ workId: 3, title: '怪物', songId: 4, phase: 'done', settledAt: 20 }),
    ]);
    expect(state).toMatchObject({
      tone: 'done',
      title: PILL_TITLE.done,
      song: null,
      note: '1곡 남음',
      expandable: true,
    });
    expect(state?.arts[1]).toBe('a.jpg');
  });

  it('one done + one analyzing uses the same done title', () => {
    const state = derivePillState([
      job({ workId: 1 }),
      job({ workId: 2, title: 'Lemon', phase: 'done', settledAt: 10 }),
    ]);
    expect(state?.title).toBe(PILL_TITLE.done);
    expect(state?.song).toBeNull();
    expect(state?.note).toBe('1곡 남음');
  });

  it('a failed song shows the failure reason and dismisses on tap', () => {
    const state = derivePillState([job({ title: 'Lemon', phase: 'failed', settledAt: 10, errorCode: 'LYRICS_NOT_FOUND' })]);
    expect(state).toMatchObject({
      tone: 'failed',
      title: PILL_TITLE.failed,
      song: 'Lemon',
      note: ' · 가사를 찾지 못했어요',
      arts: ['a.jpg'],
      expandable: false,
      tapSongId: null,
      dismissWorkId: 1,
    });
  });

  it('the latest failure wins over done and analyzing songs', () => {
    const state = derivePillState([
      job({ workId: 1 }),
      job({ workId: 2, title: 'Lemon', songId: 3, phase: 'done', settledAt: 10 }),
      job({ workId: 3, title: '怪物', phase: 'failed', settledAt: 20, errorCode: 'SONG_ANALYSIS_WORK_TIMEOUT' }),
      job({ workId: 4, title: 'アイドル', phase: 'failed', settledAt: 30 }),
    ]);
    expect(state).toMatchObject({
      tone: 'failed',
      song: 'アイドル',
      note: ' · 잠시 후 다시 시도해주세요',
      dismissWorkId: 4,
    });
  });
});

describe('failureReason', () => {
  it('maps known codes and falls back to retry-later', () => {
    expect(failureReason('LYRICS_NOT_FOUND')).toBe('가사를 찾지 못했어요');
    expect(failureReason('SONG_ANALYSIS_WORK_TIMEOUT')).toBe('시간이 너무 오래 걸렸어요');
    expect(failureReason('SONG_ANALYSIS_WORK_FAILED')).toBe('잠시 후 다시 시도해주세요');
    expect(failureReason(null)).toBe('잠시 후 다시 시도해주세요');
  });
});

describe('deriveJobPillState', () => {
  it('maps a job to a single-song pill', () => {
    expect(deriveJobPillState(job({ songId: 9, phase: 'done', settledAt: 1 }))).toMatchObject({
      tone: 'done',
      title: PILL_TITLE.done,
      song: '夜に駆ける',
      note: null,
      expandable: false,
      tapSongId: 9,
      studyHint: false,
    });
  });

  it('maps a failed job to a dismissable failure pill', () => {
    expect(deriveJobPillState(job({ workId: 5, phase: 'failed', settledAt: 1, errorCode: 'LYRICS_NOT_FOUND' }))).toMatchObject({
      tone: 'failed',
      song: '夜に駆ける',
      note: ' · 가사를 찾지 못했어요',
      tapSongId: null,
      dismissWorkId: 5,
    });
  });
});
