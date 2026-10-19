import React, { useCallback, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useKeyboardScreenY } from '../../hooks/useKeyboardScreenY';
import { AppSheetOwnedScrollView } from './AppSheetScrollables';

/** 시트 손잡이 높이(24)와 상태바 아래 여백. */
const SHEET_CHROME_HEIGHT = 36;

export type AppBottomSheetViewProps = React.ComponentProps<typeof BottomSheetView> & {
  /**
   * 본문을 시트 높이에 묶는다. 안에 스크롤이나 페이저가 들어가면 켤 것.
   * gorhom `BottomSheetView` 는 `bottom` 이 없어 높이가 내용만큼 늘어나고, 안의 스크롤이 동작하지 않는다.
   * `enableDynamicSizing` 시트에서는 켜면 안 된다(시트 높이를 본문에서 재야 한다).
   */
  fill?: boolean;
  /**
   * 입력창이 있는 `enableDynamicSizing` 시트에서 켤 것. 키보드가 떠 있는 동안 본문을 키보드 위 공간으로 줄이고
   * 맨 아래로 스크롤해 입력창과 버튼을 보인다. 끄면 시트가 키보드 위에 다 안 들어갈 때 gorhom 이 시트를 화면 위에 붙여 아래쪽이 키보드에 가린다.
   */
  fitAboveKeyboard?: boolean;
};

function KeyboardFitBody({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardScreenY();
  const scrollRef = useRef<ScrollView>(null);
  const maxHeight = keyboard.screenY == null
    ? undefined
    : Math.max(0, keyboard.screenY - insets.top - SHEET_CHROME_HEIGHT);
  const style = useMemo(() => (maxHeight == null ? undefined : { maxHeight }), [maxHeight]);
  const scrollToEndWhileCapped = useCallback(() => {
    if (maxHeight != null) scrollRef.current?.scrollToEnd({ animated: false });
  }, [maxHeight]);

  return (
    <AppSheetOwnedScrollView
      ref={scrollRef}
      style={style}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={maxHeight != null}
      onContentSizeChange={scrollToEndWhileCapped}
      onLayout={scrollToEndWhileCapped}
    >
      {children}
    </AppSheetOwnedScrollView>
  );
}

/**
 * 시트 본문. `fill`·`fitAboveKeyboard` 의 함정만 대신 처리하고 나머지는 `BottomSheetView` 그대로다.
 */
export function AppBottomSheetView({
  fill = false,
  fitAboveKeyboard = false,
  style,
  children,
  ...props
}: AppBottomSheetViewProps) {
  const resolvedStyle = useMemo(
    () => (fill ? [styles.fill, style] : style),
    [fill, style],
  );

  return (
    <BottomSheetView {...props} style={resolvedStyle}>
      {fitAboveKeyboard ? <KeyboardFitBody>{children}</KeyboardFitBody> : children}
    </BottomSheetView>
  );
}

const styles = StyleSheet.create({
  fill: {
    bottom: 0,
  },
});
