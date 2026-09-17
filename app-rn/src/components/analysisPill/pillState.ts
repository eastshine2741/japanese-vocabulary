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
  /** 부제 앞의 곡명. 넘치면 여기만 말줄임한다. 곡명을 안 보이는 상태면 null. */
  song: string | null;
  /** 곡명 뒤에 붙는 문구(구분자 포함). 항상 다 보인다. */
  note: string | null;
  arts: (string | null)[];
  /** true 면 탭이 곡별 pill 로 분해, false 면 탭이 곧바로 songDetail. */
  expandable: boolean;
  /** expandable 이 false 일 때 탭이 여는 곡. 가사 준비 전엔 null. */
  tapSongId: number | null;
  /** 실패 pill 일 때 탭이 즉시 지우는 작업. */
  dismissWorkId: number | null;
  /** true 면 탭이 학습으로 이어진다는 걸 부제와 chevron 으로 드러낸다. 접힌 단일 완료 pill 과 펼친 곡별 완료 pill. */
  studyHint: boolean;
}

/** 완료·실패 pill 을 유지하는 시간. 지나면 그 곡이 목록에서 빠진다. */
export const SETTLED_HOLD_MS = 3000;

export const PILL_TITLE = {
  analyzing: '분석하고 있어요',
  done: '분석이 끝났어요',
  failed: '분석에 실패했어요',
} as const;

/** 탭이 곧바로 songDetail 로 가는 완료 pill 의 부제. 곡명 뒤에 붙여 알린다. */
export const STUDY_HINT_NOTE = ' · 탭해서 학습 시작';

// 실패 pill 부제에 들어가는 짧은 사유. 전체 문장은 errorMessages 에 있지만 pill 한 줄엔 안 맞는다.
const FAILURE_REASON: Record<string, string> = {
  LYRICS_NOT_FOUND: '가사를 찾지 못했어요',
  SONG_ANALYSIS_WORK_TIMEOUT: '시간이 너무 오래 걸렸어요',
};
const DEFAULT_FAILURE_REASON = '잠시 후 다시 시도해주세요';

export const failureReason = (errorCode: string | null) =>
  (errorCode && FAILURE_REASON[errorCode]) || DEFAULT_FAILURE_REASON;

/** 한 곡이면 없음, 여럿이면 '외 n곡'. */
const restNote = (jobs: AnalysisJob[]) => (jobs.length > 1 ? ` 외 ${jobs.length - 1}곡` : null);

const byLatestSettled = (a: AnalysisJob, b: AnalysisJob) => (b.settledAt ?? 0) - (a.settledAt ?? 0);

const failedState = (job: AnalysisJob): PillState => ({
  tone: 'failed',
  title: PILL_TITLE.failed,
  song: job.title,
  note: ` · ${failureReason(job.errorCode)}`,
  arts: [job.artworkUrl],
  expandable: false,
  tapSongId: null,
  dismissWorkId: job.workId,
  studyHint: false,
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
      song: analyzing[0].title,
      note: restNote(analyzing),
      arts: analyzing.slice(0, 2).map(j => j.artworkUrl),
      expandable,
      tapSongId: expandable ? null : analyzing[0].songId,
      dismissWorkId: null,
      studyHint: false,
    };
  }

  const latest = done[0];
  if (analyzing.length === 0) {
    return {
      tone: 'done',
      title: PILL_TITLE.done,
      song: done[0].title,
      note: expandable ? restNote(done) : STUDY_HINT_NOTE,
      arts: done.slice(0, 2).map(j => j.artworkUrl),
      expandable,
      tapSongId: expandable ? null : latest.songId,
      dismissWorkId: null,
      studyHint: !expandable,
    };
  }

  return {
    tone: 'done',
    title: PILL_TITLE.done,
    song: latest.title,
    note: ` · ${analyzing.length}곡 남음`,
    arts: [latest.artworkUrl, analyzing[0].artworkUrl],
    expandable: true,
    tapSongId: null,
    dismissWorkId: null,
    studyHint: false,
  };
}

/** 펼침 상태의 곡별 pill 하나. */
export function deriveJobPillState(job: AnalysisJob): PillState {
  if (job.phase === 'failed') return failedState(job);
  const done = job.phase === 'done';
  return {
    tone: job.phase,
    title: PILL_TITLE[job.phase],
    song: job.title,
    note: done ? STUDY_HINT_NOTE : null,
    arts: [job.artworkUrl],
    expandable: false,
    tapSongId: job.songId,
    dismissWorkId: null,
    studyHint: done,
  };
}
