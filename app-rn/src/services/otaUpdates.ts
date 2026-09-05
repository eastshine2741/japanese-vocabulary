import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';

// expo-updates' own on-launch check (EXPO_UPDATES_CHECK_ON_LAUNCH=ALWAYS) fires
// natively before the app's process has finished attaching to a network
// (ConnectivityManager registers the app's network request only after this
// check already reported "no update available" with no error — confirmed via
// logcat). It silently misreports a not-yet-ready network as "no update", so
// cold starts never pick up a published OTA. Re-checking from JS a few
// seconds after mount runs well past that race window.
const RETRY_DELAYS_MS = [2500, 5000, 10000];

export function scheduleOtaUpdateCheck(): void {
  if (__DEV__ || !Updates.isEnabled) return;
  runWithRetries(0);
}

function runWithRetries(attempt: number): void {
  setTimeout(() => {
    checkAndApplyUpdate().catch((error) => {
      if (attempt < RETRY_DELAYS_MS.length - 1) {
        runWithRetries(attempt + 1);
      } else {
        Sentry.captureException(error, { tags: { context: 'ota-update-check' } });
      }
    });
  }, RETRY_DELAYS_MS[attempt]);
}

async function checkAndApplyUpdate(): Promise<void> {
  const result = await Updates.checkForUpdateAsync();
  if (!result.isAvailable) return;
  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();
}
