import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';

// expo-updates' on-launch check runs before the network is attached and silently reports
// "no update", so cold starts miss OTAs. Re-check from JS after that race window.
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
