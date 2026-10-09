import { Alert, Linking, Platform } from 'react-native';
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
  showStreakNotification,
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
  if (await requestPermission()) await registerToken();
}

async function registerToken(): Promise<void> {
  try {
    const token = await getToken(getFirebaseMessaging());
    if (!token) return;
    await flashcardApi.registerDeviceToken({ token, platform: getPlatform() });
    currentToken = token;
  } catch {
    // ignore — token registration is best-effort
  }
}

/** 알림 토글을 켤 때. OS 가 더 이상 다이얼로그를 띄우지 않으면 설정 앱으로 안내한다. */
export async function requestPermissionForOptIn(): Promise<void> {
  if (!FIREBASE_ENABLED) return;
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && !canAskAgain) {
      Alert.alert('알림이 꺼져 있어요', '휴대폰 설정에서 Kotonoha 알림을 허용해 주세요.', [
        { text: '닫기', style: 'cancel' },
        { text: '설정 열기', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
  } catch {
    return;
  }
  if (await requestPermission()) await registerToken();
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

// 카운트다운 숫자(네이티브 레이아웃)와 같은 빨강.
const STREAK_URGENT_COLOR = '#FF4B4B';
// Colors.primary(#16B364)는 흰 셰이드에서 대비가 2.6:1 이라 흐리다. 밝은 배경엔 짙은 초록(5:1), 다크엔 밝은 초록.
const STREAK_GREEN = '#0B8043';
const STREAK_GREEN_NIGHT = '#4ADE80';

// 연속 학습 알림은 제목·본문을 강조색으로 칠하고, 23:00 은 expiresAt(다음 04:00 KST epoch ms)까지 카운트다운을 붙인다.
// Android 전용 네이티브 모듈이 있을 때만 쓰고, 없거나 실패하면 일반 알림으로 되돌아간다.
async function tryShowStreakNotification(
  title: string,
  body: string,
  data: NonNullable<RemoteMessage['data']>,
): Promise<boolean> {
  if (Platform.OS !== 'android' || data.type !== 'streak_reminder') return false;
  const expiresAt = Number(data.expiresAt);
  const hasTimer = Number.isFinite(expiresAt) && expiresAt > Date.now();
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') stringData[k] = v;
  }
  try {
    return await showStreakNotification({
      title,
      body,
      channelId: REVIEW_CHANNEL_ID,
      expiresAt: hasTimer ? expiresAt : null,
      accentColor: hasTimer ? STREAK_URGENT_COLOR : STREAK_GREEN,
      accentColorNight: hasTimer ? STREAK_URGENT_COLOR : STREAK_GREEN_NIGHT,
      data: stringData,
    });
  } catch {
    return false;
  }
}

/** 네이티브 연속 학습 레이아웃으로 그렸으면 'custom', expo-notifications 일반 알림이면 'plain'. */
async function displayLocalNotification(
  remoteMessage: RemoteMessage,
): Promise<'custom' | 'plain'> {
  const data = remoteMessage.data ?? {};
  const title =
    typeof data.title === 'string' ? data.title : remoteMessage.notification?.title ?? '';
  const body =
    typeof data.body === 'string' ? data.body : remoteMessage.notification?.body ?? '';
  if (await tryShowStreakNotification(title, body, data)) return 'custom';
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
