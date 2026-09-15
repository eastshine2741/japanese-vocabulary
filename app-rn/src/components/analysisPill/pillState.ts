export type AnalysisJobPhase = 'analyzing' | 'done' | 'failed';

export interface AnalysisJob {
  workId: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
  /** 가사가 준비되면 채워진다. 그 전엔 songDetail 로 못 간다. */
  songId: number | null;
  phase: AnalysisJobPhase;
  /** 완료·실패 시각. 유지 시간이 지나면 목록에서 빠진다. */
  settledAt: number | null;
  /** 실패했을 때 서버가 준 사유 코드. */
  errorCode: string | null;
}

export type PillTone = 'analyzing' | 'done' | 'failed';

export interface PillState {
  tone: PillTone;
  title: string;
  subtitle: string;
  arts: (string | null)[];
  /** true 면 탭이 곡별 pill 로 분해, false 면 탭이 곧바로 songDetail. */
  expandable: boolean;
  /** expandable 이 false 일 때 탭이 여는 곡. 가사 준비 전엔 null. */
  tapSongId: number | null;
  /** 실패 pill 일 때 탭이 즉시 지우는 작업. */
  dismissWorkId: number | null;
}

/** 완료·실패 pill 을 유지하는 시간. 지나면 그 곡이 목록에서 빠진다. */
export const SETTLED_HOLD_MS = 3000;

export const PILL_TITLE = {
  analyzing: '분석하고 있어요',
  done: '분석이 끝났어요',
  failed: '분석에 실패했어요',
} as const;

// 실패 pill 부제에 들어가는 짧은 사유. 전체 문장은 errorMessages 에 있지만 pill 한 줄엔 안 맞는다.
const FAILURE_REASON: Record<string, string> = {
  LYRICS_NOT_FOUND: '가사를 찾지 못했어요',
  SONG_ANALYSIS_WORK_TIMEOUT: '시간이 너무 오래 걸렸어요',
};
const DEFAULT_FAILURE_REASON = '잠시 후 다시 시도해주세요';

export const failureReason = (errorCode: string | null) =>
  (errorCode && FAILURE_REASON[errorCode]) || DEFAULT_FAILURE_REASON;

/** 한 곡이면 제목, 여럿이면 '첫 곡 외 n곡'. */
const summarizeTitles = (jobs: AnalysisJob[]) =>
  jobs.length > 1 ? `${jobs[0].title} 외 ${jobs.length - 1}곡` : jobs[0].title;

const byLatestSettled = (a: AnalysisJob, b: AnalysisJob) => (b.settledAt ?? 0) - (a.settledAt ?? 0);

const failedState = (job: AnalysisJob): PillState => ({
  tone: 'failed',
  title: PILL_TITLE.failed,
  subtitle: `${job.title} · ${failureReason(job.errorCode)}`,
  arts: [job.artworkUrl],
  expandable: false,
  tapSongId: null,
  dismissWorkId: job.workId,
});

/** spec/AnalyzingPill 의 상태 5개를 진행 중인 작업 목록에서 계산한다. */
export function derivePillState(jobs: AnalysisJob[]): PillState | null {
  if (jobs.length === 0) return null;
  // 실패는 드물고 놓치면 안 되므로 다른 곡 상태보다 먼저 보여준다. 탭이나 유지 시간이 지나면 나머지 상태로 돌아간다.
  const failed = jobs.filter(j => j.phase === 'failed').sort(byLatestSettled);
  if (failed.length > 0) return failedState(failed[0]);

  const analyzing = jobs.filter(j => j.phase === 'analyzing');
  const done = jobs.filter(j => j.phase === 'done').sort(byLatestSettled);
  const expandable = jobs.length > 1;

  if (done.length === 0) {
    return {
      tone: 'analyzing',
      title: PILL_TITLE.analyzing,
      subtitle: summarizeTitles(analyzing),
      arts: analyzing.slice(0, 2).map(j => j.artworkUrl),
      expandable,
      tapSongId: expandable ? null : analyzing[0].songId,
      dismissWorkId: null,
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
      dismissWorkId: null,
    };
  }

  return {
    tone: 'done',
    title: done.length === 1 ? PILL_TITLE.done : `${done.length}곡 분석이 끝났어요`,
    subtitle: `${latest.title} · ${analyzing.length}곡 남음`,
    arts: [latest.artworkUrl, analyzing[0].artworkUrl],
    expandable: true,
    tapSongId: null,
    dismissWorkId: null,
  };
}

/** 펼침 상태의 곡별 pill 하나. */
export function deriveJobPillState(job: AnalysisJob): PillState {
  if (job.phase === 'failed') return failedState(job);
  return {
    tone: job.phase,
    title: PILL_TITLE[job.phase],
    subtitle: job.title,
    arts: [job.artworkUrl],
    expandable: false,
    tapSongId: job.songId,
    dismissWorkId: null,
  };
}
