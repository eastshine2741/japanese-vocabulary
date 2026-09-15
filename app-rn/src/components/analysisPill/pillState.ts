export type AnalysisJobPhase = 'analyzing' | 'done';

export interface AnalysisJob {
  workId: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
  /** 가사가 준비되면 채워진다. 그 전엔 songDetail 로 못 간다. */
  songId: number | null;
  phase: AnalysisJobPhase;
  doneAt: number | null;
}

export type PillTone = 'analyzing' | 'done';

export interface PillState {
  tone: PillTone;
  title: string;
  subtitle: string;
  arts: (string | null)[];
  /** true 면 탭이 곡별 pill 로 분해, false 면 탭이 곧바로 songDetail. */
  expandable: boolean;
  /** expandable 이 false 일 때 탭이 여는 곡. 가사 준비 전엔 null. */
  tapSongId: number | null;
}

/** 완료 pill 을 유지하는 시간. 지나면 완료 곡이 목록에서 빠진다. */
export const DONE_HOLD_MS = 3000;

export const PILL_TITLE = {
  analyzing: '분석하고 있어요',
  done: '분석이 끝났어요',
} as const;

/** 한 곡이면 제목, 여럿이면 '첫 곡 외 n곡'. */
const summarizeTitles = (jobs: AnalysisJob[]) =>
  jobs.length > 1 ? `${jobs[0].title} 외 ${jobs.length - 1}곡` : jobs[0].title;

/** spec/AnalyzingPill 의 상태 4개를 진행 중인 작업 목록에서 계산한다. */
export function derivePillState(jobs: AnalysisJob[]): PillState | null {
  if (jobs.length === 0) return null;
  const analyzing = jobs.filter(j => j.phase === 'analyzing');
  const done = jobs
    .filter(j => j.phase === 'done')
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const expandable = jobs.length > 1;

  if (done.length === 0) {
    return {
      tone: 'analyzing',
      title: PILL_TITLE.analyzing,
      subtitle: summarizeTitles(analyzing),
      arts: analyzing.slice(0, 2).map(j => j.artworkUrl),
      expandable,
      tapSongId: expandable ? null : analyzing[0].songId,
    };
  }

  const latest = done[0];
  if (analyzing.length === 0) {
    return {
      tone: 'done',
      title: PILL_TITLE.done,
      subtitle: summarizeTitles(done),
      arts: done.slice(0, 2).map(j => j.artworkUrl),
      expandable,
      tapSongId: expandable ? null : latest.songId,
    };
  }

  return {
    tone: 'done',
    title: done.length === 1 ? PILL_TITLE.done : `${done.length}곡 분석이 끝났어요`,
    subtitle: `${latest.title} · ${analyzing.length}곡 남음`,
    arts: [latest.artworkUrl, analyzing[0].artworkUrl],
    expandable: true,
    tapSongId: null,
  };
}

/** 펼침 상태의 곡별 pill 하나. */
export function deriveJobPillState(job: AnalysisJob): PillState {
  return {
    tone: job.phase,
    title: job.phase === 'done' ? PILL_TITLE.done : PILL_TITLE.analyzing,
    subtitle: job.title,
    arts: [job.artworkUrl],
    expandable: false,
    tapSongId: job.songId,
  };
}
