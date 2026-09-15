import { describe, expect, it } from 'vitest';
import { AnalysisJob, derivePillState, deriveJobPillState, PILL_TITLE } from './pillState';

const job = (over: Partial<AnalysisJob>): AnalysisJob => ({
  workId: 1,
  title: '夜に駆ける',
  artist: 'YOASOBI',
  artworkUrl: 'a.jpg',
  songId: null,
  phase: 'analyzing',
  doneAt: null,
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
      subtitle: '夜に駆ける',
      expandable: false,
      tapSongId: null,
    });
    expect(derivePillState([job({ songId: 7 })])?.tapSongId).toBe(7);
  });

  it('two analyzing songs name the first and count the rest, and expand on tap', () => {
    const state = derivePillState([job({}), job({ workId: 2, title: '怪物', artworkUrl: 'b.jpg' })]);
    expect(state).toMatchObject({
      tone: 'analyzing',
      subtitle: '夜に駆ける 외 1곡',
      arts: ['a.jpg', 'b.jpg'],
      expandable: true,
      tapSongId: null,
    });
  });

  it('all done with several songs names the latest and counts the rest', () => {
    const state = derivePillState([
      job({ workId: 1, title: 'Lemon', songId: 3, phase: 'done', doneAt: 10 }),
      job({ workId: 2, title: '怪物', songId: 4, phase: 'done', doneAt: 20 }),
      job({ workId: 3, title: 'アイドル', songId: 5, phase: 'done', doneAt: 30 }),
    ]);
    expect(state?.subtitle).toBe('アイドル 외 2곡');
  });

  it('single done song shows the done tone and opens it', () => {
    const state = derivePillState([job({ title: 'Lemon', songId: 3, phase: 'done', doneAt: 10 })]);
    expect(state).toMatchObject({
      tone: 'done',
      title: PILL_TITLE.done,
      subtitle: 'Lemon',
      expandable: false,
      tapSongId: 3,
    });
  });

  it('done + analyzing names the latest finished song and the remaining count', () => {
    const state = derivePillState([
      job({ workId: 1, title: '夜に駆ける' }),
      job({ workId: 2, title: 'Lemon', artworkUrl: 'l.jpg', songId: 3, phase: 'done', doneAt: 10 }),
      job({ workId: 3, title: '怪物', songId: 4, phase: 'done', doneAt: 20 }),
    ]);
    expect(state).toMatchObject({
      tone: 'done',
      title: '2곡 분석이 끝났어요',
      subtitle: '怪物 · 1곡 남음',
      expandable: true,
    });
    expect(state?.arts[1]).toBe('a.jpg');
  });

  it('one done + one analyzing uses the plain done title', () => {
    const state = derivePillState([
      job({ workId: 1 }),
      job({ workId: 2, title: 'Lemon', phase: 'done', doneAt: 10 }),
    ]);
    expect(state?.title).toBe(PILL_TITLE.done);
    expect(state?.subtitle).toBe('Lemon · 1곡 남음');
  });
});

describe('deriveJobPillState', () => {
  it('maps a job to a single-song pill', () => {
    expect(deriveJobPillState(job({ songId: 9, phase: 'done', doneAt: 1 }))).toMatchObject({
      tone: 'done',
      title: PILL_TITLE.done,
      subtitle: '夜に駆ける',
      expandable: false,
      tapSongId: 9,
    });
  });
});
