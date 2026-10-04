import { getApp } from '@react-native-firebase/app';
import {
  getAnalytics,
  logEvent,
  logScreenView,
  setUserId,
} from '@react-native-firebase/analytics';

// Without a registered google-services client the default FirebaseApp doesn't exist and analytics calls throw.
const FIREBASE_ENABLED = process.env.EXPO_PUBLIC_FIREBASE_DISABLED !== '1';

/**
 * 곡 탐색 퍼널(검색 -> 곡 선택 -> 분석 결과)과 가사에서 복습으로 넘어가는 구간(학습 진입 -> 카드
 * 뒤집기 -> 평가 -> 이탈)을 남긴다. 가사 열람은 SongDetail screen_view 로, 체류 시간은 BigQuery 에서
 * 다음 screen_view 까지의 차이로 계산한다.
 */
type AnalyticsEvent =
  | { name: 'search_submit'; params: { query: string; result_count: number } }
  | { name: 'song_select'; params: { song_id?: number; is_new: boolean } }
  | { name: 'song_analyze_result'; params: { outcome: AnalyzeOutcome } }
  | { name: 'card_reveal'; params: StudyCardParams }
  | { name: 'card_rate'; params: StudyCardParams & { rating: number } }
  | { name: 'review_exit'; params: ReviewExitParams };

export type AnalyzeOutcome = 'success' | 'lyrics_not_found' | 'failed';

/** 곡 상세에서 복습 화면을 연 버튼. cta: 상단 학습 버튼, tier: 단계 학습 카드, word: 단어 탭. SongReview screen_view 파라미터. */
export type StudyEntryTrigger = 'cta' | 'tier' | 'word';

/** position: 이번 세션에서 이 카드 앞에 평가를 마친 카드 수 (첫 카드면 0). */
export interface StudyCardParams {
  mode: 'home' | 'source';
  position: number;
  is_preview: boolean;
}

/** 곡 진입 복습 화면을 떠날 때의 상태. 몇 장째에서, 뒷면을 본 채로 나갔는지 본다. */
export interface ReviewExitParams {
  song_id: number;
  /** leave: 화면을 떠남, background: 앱이 백그라운드로 감(앱 종료 포함) */
  how: 'leave' | 'background';
  reviewed: number;
  revealed: boolean;
  completed: boolean;
  status: 'loading' | 'ready' | 'error';
  dwell_sec: number;
}

// 모든 발화는 best-effort. 로깅 실패가 화면 동작을 막아선 안 된다.
function send(log: (analytics: ReturnType<typeof getAnalytics>) => void | Promise<void>): void {
  if (!FIREBASE_ENABLED) return;
  try {
    const result = log(getAnalytics(getApp()));
    if (result) result.catch(() => undefined);
  } catch {
    // ignore
  }
}

function track(event: AnalyticsEvent): void {
  send(analytics => logEvent(analytics, event.name, event.params));
}

export function trackSearchSubmit(query: string, resultCount: number): void {
  track({ name: 'search_submit', params: { query, result_count: resultCount } });
}

export function trackSongSelect(songId: number | undefined, isNew: boolean): void {
  track({ name: 'song_select', params: { song_id: songId, is_new: isNew } });
}

export const analyzeOutcomeOf = (errorCode: string | null | undefined): AnalyzeOutcome =>
  errorCode === 'LYRICS_NOT_FOUND' ? 'lyrics_not_found' : 'failed';

export function trackSongAnalyzeResult(outcome: AnalyzeOutcome): void {
  track({ name: 'song_analyze_result', params: { outcome } });
}

export function trackCardReveal(params: StudyCardParams): void {
  track({ name: 'card_reveal', params });
}

export function trackCardRate(params: StudyCardParams, rating: number): void {
  track({ name: 'card_rate', params: { ...params, rating } });
}

export function trackReviewExit(params: ReviewExitParams): void {
  track({ name: 'review_exit', params });
}

export type ScreenViewParams = Record<string, string | number>;

/** RN 은 Activity 하나를 공유해 GA4 자동 screen_view 가 안 찍히므로 직접 찍는다. */
export function trackScreenView(screenName: string, params?: ScreenViewParams): void {
  send(analytics =>
    logScreenView(analytics, { ...params, screen_name: screenName, screen_class: screenName }),
  );
}

/** users.id 로 GA4 와 DB 지표(리텐션/스트릭)를 같은 유저 기준으로 붙인다. */
export function setAnalyticsUserId(userId: string | null): void {
  send(analytics => setUserId(analytics, userId));
}
