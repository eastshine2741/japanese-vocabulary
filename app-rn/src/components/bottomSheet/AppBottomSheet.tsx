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

interface AppBottomSheetChromeProps {
  variant?: BottomSheetVariant;
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
  bottomInset,
  detached,
  style,
  backgroundStyle,
  handleStyle,
  handleIndicatorStyle,
  backdropComponent,
}: AppBottomSheetChromeProps & {
  bottomInset?: number;
  detached?: boolean;
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
    bottomInset,
    detached,
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
      bottomInset,
      detached,
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
    bottomInset,
    detached,
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
      bottomInset,
      detached,
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
