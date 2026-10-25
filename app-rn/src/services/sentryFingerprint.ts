import type { ErrorEvent } from '@sentry/react-native';

const NATIVE_CALL_REJECTED = /^Call to function '([^']+)' has been rejected\./;

// expo 네이티브 모듈 reject 는 스택이 CodedError 생성자 프레임뿐이라 Sentry 가 모듈과 상관없이 한 이슈로 묶는다.
// 호출한 네이티브 함수로 나눠야 한쪽을 고친 뒤 다른 쪽 이벤트가 그 이슈를 regressed 로 되살리지 않는다.
export function fingerprintNativeCallRejection(event: ErrorEvent): ErrorEvent {
  const message = event.exception?.values?.at(-1)?.value;
  const nativeFunction = message?.match(NATIVE_CALL_REJECTED)?.[1];
  if (nativeFunction) {
    event.fingerprint = ['native-call-rejected', nativeFunction];
  }
  return event;
}
