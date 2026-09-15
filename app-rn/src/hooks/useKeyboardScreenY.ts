import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export interface KeyboardScreenY {
  /** 화면 위쪽 기준 키보드 윗변의 y. 키보드가 없으면 null. */
  screenY: number | null;
  /** 키보드가 열리고 닫히는 데 걸리는 시간(ms). iOS 만 알려주고 Android 는 0. */
  duration: number;
}

const HIDDEN: KeyboardScreenY = { screenY: null, duration: 0 };

// iOS 는 will* 이벤트로 키보드가 움직이기 전에 미리 알려주지만 Android 에는 did* 밖에 없다.
const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/**
 * 소프트 키보드 윗변의 화면 좌표. 화면 위쪽 끝에 붙은 오버레이가 키보드를 피할 때 쓴다.
 * adjustResize 로 루트 뷰가 줄어들든 말든 화면 좌표라 그대로 쓸 수 있다.
 */
export function useKeyboardScreenY(): KeyboardScreenY {
  const [keyboard, setKeyboard] = useState<KeyboardScreenY>(() => {
    const metrics = Keyboard.isVisible() ? Keyboard.metrics() : undefined;
    return metrics ? { screenY: metrics.screenY, duration: 0 } : HIDDEN;
  });

  useEffect(() => {
    const show = Keyboard.addListener(SHOW_EVENT, e =>
      setKeyboard({ screenY: e.endCoordinates.screenY, duration: e.duration }));
    const hide = Keyboard.addListener(HIDE_EVENT, e =>
      setKeyboard({ screenY: null, duration: e.duration }));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return keyboard;
}
