import { Platform } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { flashcardApi } from '../api/flashcardApi';
import { navigate } from '../navigation/navigationRef';

let currentToken: string | null = null;
let handlersRegistered = false;

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

export function registerNotificationHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

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

  messaging().onMessage(async (remoteMessage) => {
    const title = remoteMessage.notification?.title ?? '';
    const body = remoteMessage.notification?.body ?? '';
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: remoteMessage.data ?? {} },
      trigger: null,
    });
  });

  messaging().onNotificationOpenedApp((remoteMessage) => {
    handleData(remoteMessage.data);
  });

  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) handleData(remoteMessage.data);
    });

  // expo-notifications: handle taps on locally-displayed (foreground) notifications
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as
      | FirebaseMessagingTypes.RemoteMessage['data']
      | undefined;
    handleData(data);
  });
}
