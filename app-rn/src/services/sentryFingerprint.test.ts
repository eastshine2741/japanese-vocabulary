import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react-native';
import { fingerprintNativeCallRejection } from './sentryFingerprint';

function errorEvent(value: string): ErrorEvent {
  return { type: undefined, exception: { values: [{ type: 'Error', value }] } };
}

describe('fingerprintNativeCallRejection', () => {
  it('네이티브 함수 이름으로 fingerprint 를 정한다', () => {
    const event = fingerprintNativeCallRejection(
      errorEvent(
        "Call to function 'ExpoNavigationBar.setButtonStyleAsync' has been rejected.\n→ Caused by: The current activity is no longer available",
      ),
    );
    expect(event.fingerprint).toEqual(['native-call-rejected', 'ExpoNavigationBar.setButtonStyleAsync']);
  });

  it('원인 문구가 달라도 같은 함수면 같은 fingerprint 다', () => {
    const a = fingerprintNativeCallRejection(
      errorEvent("Call to function 'ExpoUpdates.checkForUpdateAsync' has been rejected.\n→ Caused by: Failed to check for update"),
    );
    const b = fingerprintNativeCallRejection(
      errorEvent("Call to function 'ExpoUpdates.checkForUpdateAsync' has been rejected.\n→ Caused by: timeout"),
    );
    expect(a.fingerprint).toEqual(b.fingerprint);
  });

  it('다른 에러는 기본 묶음을 그대로 쓴다', () => {
    expect(fingerprintNativeCallRejection(errorEvent('Failed to load all assets')).fingerprint).toBeUndefined();
  });
});
