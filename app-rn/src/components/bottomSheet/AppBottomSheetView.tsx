import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';

export type AppBottomSheetViewProps = React.ComponentProps<typeof BottomSheetView> & {
  /**
   * 본문을 시트 높이에 묶는다. 안에 스크롤이나 페이저가 들어가면 켤 것.
   * gorhom `BottomSheetView` 는 `bottom` 이 없어 높이가 내용만큼 늘어나고, 안의 스크롤이 동작하지 않는다.
   * `enableDynamicSizing` 시트에서는 켜면 안 된다(시트 높이를 본문에서 재야 한다).
   */
  fill?: boolean;
};

/**
 * 시트 본문. `fill` 의 함정만 대신 처리하고 나머지는 `BottomSheetView` 그대로다.
 */
export function AppBottomSheetView({ fill = false, style, ...props }: AppBottomSheetViewProps) {
  const resolvedStyle = useMemo(
    () => (fill ? [styles.fill, style] : style),
    [fill, style],
  );

  return <BottomSheetView {...props} style={resolvedStyle} />;
}

const styles = StyleSheet.create({
  fill: {
    bottom: 0,
  },
});
