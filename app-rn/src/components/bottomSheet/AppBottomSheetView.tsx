import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';

export type AppBottomSheetViewProps = React.ComponentProps<typeof BottomSheetView> & {
  /**
   * 본문을 시트 높이에 묶는다. 안에 스크롤이나 페이저가 들어가면 켤 것.
   *
   * gorhom 의 `BottomSheetView` 는 넘긴 스타일 뒤에 자기 스타일
   * (`position: absolute` + `top/left/right`)을 덮어쓴다. `bottom` 이 없으면 높이가
   * 내용만큼 늘어나서 `flex: 1` 이 죽고, 안의 스크롤은 "내용이 다 들어간다"고 판단해
   * 스크롤이 아예 생기지 않는다(넘친 부분은 시트 밖에서 잘림).
   *
   * 반대로 `enableDynamicSizing` 시트에서는 켜면 안 된다 — 시트 높이를 본문 높이에서
   * 재야 하는데 본문을 시트 높이에 묶으면 그 측정이 성립하지 않는다.
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
