import { Platform } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { flashcardApi } from '../api/flashcardApi';
import { navigate } from '../navigation/navigationRef';

const REVIEW_CHANNEL_ID = 'review-reminders';

// Mirrors app.config.js: when Firebase is disabled (worktree builds without a
// registered google-services client), the native default FirebaseApp doesn't
// exist, so any messaging() call throws. Guard every messaging() use behind this.
const FIREBASE_ENABLED = process.env.EXPO_PUBLIC_FIREBASE_DISABLED !== '1';

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
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
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
    const token = await messaging().getToken();
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

function handleData(data: FirebaseMessagingTypes.RemoteMessage['data']): void {
  if (!data) return;
  if (data.type === 'review_reminder' && data.flashcardId != null) {
    const id = Number(data.flashcardId);
    if (Number.isFinite(id)) {
      navigate('Review', { startFlashcardId: id });
    }
  }
}

async function displayLocalNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const data = remoteMessage.data ?? {};
  const title = typeof data.title === 'string' ? data.title : '';
  const body = typeof data.body === 'string' ? data.body : '';
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

// Module-scope: must be registered BEFORE the runtime delivers a data-only push to a killed or
// backgrounded app. Importing this module from App.tsx ensures the handler is set during JS init.
if (FIREBASE_ENABLED) {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    await displayLocalNotification(remoteMessage);
  });
}

export function registerNotificationHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ensureAndroidChannel();

  // Foreground display behaviour for expo-notifications local alerts
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
    messaging().onTokenRefresh(async (newToken) => {
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

    // Foreground data-only arrival → render locally via expo-notifications
    messaging().onMessage(async (remoteMessage) => {
      await displayLocalNotification(remoteMessage);
    });
  }

  // Tap handler. Covers both foreground onMessage path and background
  // setBackgroundMessageHandler path; expo-notifications also fires this for cold-start taps on a
  // locally-displayed notification.
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as
      | FirebaseMessagingTypes.RemoteMessage['data']
      | undefined;
    handleData(data);
  });
}
