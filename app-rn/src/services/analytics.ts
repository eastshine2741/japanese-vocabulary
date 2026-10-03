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
 * 곡 탐색 퍼널(검색 -> 곡 선택 -> 분석 결과)만 남긴다. 가사 열람은 SongDetail screen_view 로,
 * 체류 시간은 BigQuery 에서 다음 screen_view 까지의 차이로 계산한다.
 */
type AnalyticsEvent =
  | { name: 'search_submit'; params: { query: string; result_count: number } }
  | { name: 'song_select'; params: { song_id?: number; is_new: boolean } }
  | { name: 'song_analyze_result'; params: { outcome: AnalyzeOutcome } };

export type AnalyzeOutcome = 'success' | 'lyrics_not_found' | 'failed';

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
