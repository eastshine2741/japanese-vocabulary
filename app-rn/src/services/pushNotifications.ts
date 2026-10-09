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

async function displayLocalNotification(
  remoteMessage: RemoteMessage,
): Promise<void> {
  const data = remoteMessage.data ?? {};
  const title =
    typeof data.title === 'string' ? data.title : remoteMessage.notification?.title ?? '';
  const body =
    typeof data.body === 'string' ? data.body : remoteMessage.notification?.body ?? '';
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      ...(Platform.OS === 'android' ? { channelId: REVIEW_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
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

  // Tap handler for locally displayed notifications, including cold-start taps.
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as
      | RemoteMessage['data']
      | undefined;
    handleData(data);
  });
}
