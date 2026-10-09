import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission as requestMessagingPermission,
  setBackgroundMessageHandler,
  getToken,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { flashcardApi } from '../api/flashcardApi';
import { navigate } from '../navigation/navigationRef';
import {
  addStreakPressListener,
  consumeInitialStreakPress,
  showStreakCountdown,
} from '../../modules/streak-notification';

const REVIEW_CHANNEL_ID = 'review-reminders';

// Without a registered google-services client (worktree builds) messaging() throws; guard every use.
const FIREBASE_ENABLED = process.env.EXPO_PUBLIC_FIREBASE_DISABLED !== '1';

function getFirebaseMessaging() {
  return getMessaging(getApp());
}

let currentToken: string | null = null;
let handlersRegistered = false;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // HIGH importance is required for heads-up (slide-down) notifications. Default channel is LOW,
  // which silently posts to the status bar.
  await Notifications.setNotificationChannelAsync(REVIEW_CHANNEL_ID, {
    name: '복습 알림',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

function getPlatform(): 'IOS' | 'ANDROID' {
  return Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
}

async function requestPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') return true;

    // RNFirebase iOS path — covers iOS explicit auth + Android 13+ POST_NOTIFICATIONS
    const authStatus = await requestMessagingPermission(getFirebaseMessaging());
    return (
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

export async function requestPermissionAndRegisterToken(): Promise<void> {
  if (!FIREBASE_ENABLED) return;
  const granted = await requestPermission();
  if (!granted) return;

  try {
    const token = await getToken(getFirebaseMessaging());
    if (!token) return;
    await flashcardApi.registerDeviceToken({ token, platform: getPlatform() });
    currentToken = token;
  } catch {
    // ignore — token registration is best-effort
  }
}

export async function unregisterCurrentToken(): Promise<void> {
  if (!currentToken) return;
  const token = currentToken;
  currentToken = null;
  try {
    await flashcardApi.unregisterDeviceToken({ token });
  } catch {
    // ignore — logout proceeds even if server cleanup fails
  }
}

function handleData(data: RemoteMessage['data']): void {
  if (!data) return;
  // 연속 학습 알림 — 탭하면 홈 첫 카드.
  if (data.type === 'streak_reminder') {
    navigate('Main', { screen: 'Home' });
    return;
  }
  // 노래방 신곡 알림 — 그날 올라온 곡 목록.
  if (data.type === 'karaoke_new_songs') {
    navigate('KaraokeNewSongs');
    return;
  }
  // AnalysisNotificationDispatcher(batch) 가 songId 를 문자열로 실어 보낸다.
  if (data.type === 'song_analysis_completed' && data.songId != null) {
    const songId = Number(data.songId);
    if (Number.isFinite(songId)) {
      navigate('SongDetail', { songId, origin: 'AnalysisPush' });
    }
  }
}

function handleRemoteMessage(remoteMessage: RemoteMessage | null): void {
  handleData(remoteMessage?.data);
}

// 23:00 연속 학습 알림의 expiresAt(다음 04:00 KST epoch ms)까지 줄어드는 카운트다운.
// Android 전용 네이티브 모듈이 있을 때만 쓰고, 없거나 실패하면 일반 알림으로 되돌아간다.
async function tryShowStreakCountdown(
  title: string,
  body: string,
  data: NonNullable<RemoteMessage['data']>,
): Promise<boolean> {
  if (Platform.OS !== 'android' || data.type !== 'streak_reminder') return false;
  const expiresAt = Number(data.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') stringData[k] = v;
  }
  try {
    return await showStreakCountdown({
      title,
      body,
      channelId: REVIEW_CHANNEL_ID,
      expiresAt,
      data: stringData,
    });
  } catch {
    return false;
  }
}

/** 카운트다운으로 그렸으면 'countdown', expo-notifications 일반 알림이면 'plain'. */
async function displayLocalNotification(
  remoteMessage: RemoteMessage,
): Promise<'countdown' | 'plain'> {
  const data = remoteMessage.data ?? {};
  const title =
    typeof data.title === 'string' ? data.title : remoteMessage.notification?.title ?? '';
  const body =
    typeof data.body === 'string' ? data.body : remoteMessage.notification?.body ?? '';
  if (await tryShowStreakCountdown(title, body, data)) return 'countdown';
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      ...(Platform.OS === 'android' ? { channelId: REVIEW_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
  return 'plain';
}

/** 디버그 오버레이용: 23:00 streak_reminder data-only 푸시가 도착한 것처럼 같은 경로로 그린다. */
export async function debugShowStreakReminder(input: {
  title: string;
  body: string;
  expiresAt: number;
}): Promise<'countdown' | 'plain' | 'no-permission'> {
  // 워크트리 빌드는 Firebase 가 꺼져 있어 로그인 때 권한 요청을 건너뛴다.
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return 'no-permission';
  await ensureAndroidChannel();
  return displayLocalNotification({
    data: {
      type: 'streak_reminder',
      title: input.title,
      body: input.body,
      expiresAt: String(input.expiresAt),
    },
  } as unknown as RemoteMessage);
}

// Module-scope: must be registered before a data-only push reaches a killed or backgrounded app.
if (FIREBASE_ENABLED) {
  setBackgroundMessageHandler(getFirebaseMessaging(), async (remoteMessage) => {
    if (remoteMessage.notification) return;
    await displayLocalNotification(remoteMessage);
  });
}

export function registerNotificationHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ensureAndroidChannel();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (FIREBASE_ENABLED) {
    onTokenRefresh(getFirebaseMessaging(), async (newToken) => {
      try {
        if (currentToken && currentToken !== newToken) {
          await flashcardApi.unregisterDeviceToken({ token: currentToken });
        }
        await flashcardApi.registerDeviceToken({ token: newToken, platform: getPlatform() });
        currentToken = newToken;
      } catch {
        // ignore — will retry next refresh / next signIn
      }
    });

    // Foreground FCM arrival -> render locally because the OS only auto-displays in background.
    onMessage(getFirebaseMessaging(), async (remoteMessage) => {
      await displayLocalNotification(remoteMessage);
    });

    onNotificationOpenedApp(getFirebaseMessaging(), handleRemoteMessage);
    getInitialNotification(getFirebaseMessaging()).then(handleRemoteMessage);
  }

  // 카운트다운 알림은 expo-notifications 밖에서 그려서 탭도 따로 받는다.
  addStreakPressListener(handleData);
  const initialStreakPress = consumeInitialStreakPress();
  if (initialStreakPress) handleData(initialStreakPress);

  // Tap handler for locally displayed notifications, including cold-start taps.
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as
      | RemoteMessage['data']
      | undefined;
    handleData(data);
  });
}
