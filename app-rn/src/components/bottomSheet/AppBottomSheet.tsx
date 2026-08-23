import React, { useCallback, useMemo } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetModal as GorhomBottomSheetModal,
} from '@gorhom/bottom-sheet';
import type {
  BottomSheetBackdropProps,
  BottomSheetModalProps,
  BottomSheetProps,
} from '@gorhom/bottom-sheet';
import { Colors } from '../../theme/theme';
import { Layers } from '../../theme/layers';

type BottomSheetVariant = 'standard' | 'floating';

// 시트 pan 은 세로 의도가 분명할 때만 잡고, 가로로 밀면 실패시켜 안쪽 가로 스크롤에 넘긴다.
const VERTICAL_DRAG_ACTIVE_OFFSET_Y: [number, number] = [-10, 10];
const HORIZONTAL_DRAG_FAIL_OFFSET_X: [number, number] = [-10, 10];

interface AppBottomSheetChromeProps {
  variant?: BottomSheetVariant;
  /**
   * 본문에 가로 스크롤(페이저 등)이 있는 시트. 켜면 시트 pan 이 세로 드래그만 잡는다.
   * 이게 없으면 가로 스와이프를 시트가 훔쳐서 페이지가 넘어가지 않는다.
   */
  hasHorizontalContent?: boolean;
  showBackdrop?: boolean;
  backdropOpacity?: number;
  backdropStyle?: StyleProp<ViewStyle>;
  floatingBottomOffset?: number;
  sheetZIndex?: number;
}

export type AppBottomSheetRef = React.ElementRef<typeof GorhomBottomSheet>;
export type AppBottomSheetModalRef = React.ElementRef<typeof GorhomBottomSheetModal>;

export type AppBottomSheetProps = BottomSheetProps & AppBottomSheetChromeProps;
export type AppBottomSheetModalProps<T = any> = BottomSheetModalProps<T> & AppBottomSheetChromeProps;

function useAppSheetChrome({
  variant = 'standard',
  showBackdrop,
  backdropOpacity = 0.25,
  backdropStyle,
  floatingBottomOffset = 12,
  sheetZIndex,
  hasHorizontalContent,
  bottomInset,
  detached,
  enableOverDrag,
  style,
  backgroundStyle,
  handleStyle,
  handleIndicatorStyle,
  backdropComponent,
}: AppBottomSheetChromeProps & {
  bottomInset?: number;
  detached?: boolean;
  enableOverDrag?: boolean;
  style?: BottomSheetProps['style'];
  backgroundStyle?: BottomSheetProps['backgroundStyle'];
  handleStyle?: BottomSheetProps['handleStyle'];
  handleIndicatorStyle?: BottomSheetProps['handleIndicatorStyle'];
  backdropComponent?: BottomSheetProps['backdropComponent'];
}) {
  const insets = useSafeAreaInsets();
  const isFloating = variant === 'floating';
  const shouldShowBackdrop = showBackdrop ?? isFloating;
  const resolvedZIndex = sheetZIndex ?? (isFloating || shouldShowBackdrop ? Layers.modalSheet : undefined);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={backdropOpacity}
        style={[props.style, styles.backdrop, backdropStyle]}
      />
    ),
    [backdropOpacity, backdropStyle],
  );

  const zIndexStyle = useMemo(
    () => (resolvedZIndex == null ? null : { zIndex: resolvedZIndex, elevation: resolvedZIndex }),
    [resolvedZIndex],
  );

  return {
    detached: isFloating ? (detached ?? true) : detached,
    // over-drag 을 끈 시트에서 기본값 2.5 는 본문 아래에 쓸데없는 여유 패딩(약 70dp)을
    // 만든다. 그 패딩은 시트 밖에 걸려서 본문 마지막 줄을 가리고, 시트 위치에 따라 매
    // 프레임 본문 높이가 다시 계산돼 드래그를 무겁게 한다.
    overDragResistanceFactor: enableOverDrag === false ? 0 : undefined,
    activeOffsetY: hasHorizontalContent ? VERTICAL_DRAG_ACTIVE_OFFSET_Y : undefined,
    failOffsetX: hasHorizontalContent ? HORIZONTAL_DRAG_FAIL_OFFSET_X : undefined,
    bottomInset: bottomInset ?? (isFloating ? insets.bottom + floatingBottomOffset : undefined),
    backdropComponent: backdropComponent ?? (shouldShowBackdrop ? renderBackdrop : undefined),
    style: isFloating ? [styles.floatingSheet, zIndexStyle, style] : [zIndexStyle, style],
    backgroundStyle: isFloating ? [styles.floatingBackground, backgroundStyle] : backgroundStyle,
    handleStyle: isFloating ? [styles.handle, handleStyle] : handleStyle,
    handleIndicatorStyle: isFloating ? [styles.handleIndicator, handleIndicatorStyle] : handleIndicatorStyle,
  };
}

export const AppBottomSheet = React.forwardRef<AppBottomSheetRef, AppBottomSheetProps>(
  function AppBottomSheet({
    variant,
    showBackdrop,
    backdropOpacity,
    backdropStyle,
    floatingBottomOffset,
    sheetZIndex,
    hasHorizontalContent,
    bottomInset,
    detached,
    enableOverDrag,
    style,
    backgroundStyle,
    handleStyle,
    handleIndicatorStyle,
    backdropComponent,
    ...props
  }, ref) {
    const chrome = useAppSheetChrome({
      variant,
      showBackdrop,
      backdropOpacity,
      backdropStyle,
      floatingBottomOffset,
      sheetZIndex,
      hasHorizontalContent,
      bottomInset,
      detached,
      enableOverDrag,
      style,
      backgroundStyle,
      handleStyle,
      handleIndicatorStyle,
      backdropComponent,
    });

    return (
      <GorhomBottomSheet
        ref={ref}
        bottomInset={chrome.bottomInset}
        detached={chrome.detached}
        enableOverDrag={enableOverDrag}
        overDragResistanceFactor={chrome.overDragResistanceFactor}
        activeOffsetY={chrome.activeOffsetY}
        failOffsetX={chrome.failOffsetX}
        backdropComponent={chrome.backdropComponent}
        style={chrome.style}
        backgroundStyle={chrome.backgroundStyle}
        handleStyle={chrome.handleStyle}
        handleIndicatorStyle={chrome.handleIndicatorStyle}
        {...props}
      />
    );
  },
);

export const AppBottomSheetModal = React.forwardRef<AppBottomSheetModalRef, AppBottomSheetModalProps>(
  function AppBottomSheetModal({
    variant = 'floating',
    showBackdrop,
    backdropOpacity,
    backdropStyle,
    floatingBottomOffset,
    sheetZIndex,
    hasHorizontalContent,
    bottomInset,
    detached,
    enableOverDrag,
    style,
    backgroundStyle,
    handleStyle,
    handleIndicatorStyle,
    backdropComponent,
    ...props
  }, ref) {
    const chrome = useAppSheetChrome({
      variant,
      showBackdrop,
      backdropOpacity,
      backdropStyle,
      floatingBottomOffset,
      sheetZIndex,
      hasHorizontalContent,
      bottomInset,
      detached,
      enableOverDrag,
      style,
      backgroundStyle,
      handleStyle,
      handleIndicatorStyle,
      backdropComponent,
    });

    return (
      <GorhomBottomSheetModal
        ref={ref}
        bottomInset={chrome.bottomInset}
        detached={chrome.detached}
        enableOverDrag={enableOverDrag}
        overDragResistanceFactor={chrome.overDragResistanceFactor}
        activeOffsetY={chrome.activeOffsetY}
        failOffsetX={chrome.failOffsetX}
        backdropComponent={chrome.backdropComponent}
        style={chrome.style}
        backgroundStyle={chrome.backgroundStyle}
        handleStyle={chrome.handleStyle}
        handleIndicatorStyle={chrome.handleIndicatorStyle}
        {...props}
      />
    );
  },
);

const styles = StyleSheet.create({
  backdrop: {
    zIndex: Layers.modalBackdrop,
    elevation: Layers.modalBackdrop,
  },
  floatingSheet: {
    marginHorizontal: 12,
  },
  floatingBackground: {
    backgroundColor: Colors.background,
    borderRadius: 24,
  },
  handle: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
  },
});
