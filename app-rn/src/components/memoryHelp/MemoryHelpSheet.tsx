import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppBottomSheetModal, AppBottomSheetModalRef, AppBottomSheetView } from '../bottomSheet';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

export interface MemoryHelpSheetRef {
  present: () => void;
}

interface MemoryHelpItem {
  color: string;
  title: string;
  desc: string;
}

const HELP_ITEMS: MemoryHelpItem[] = [
  {
    color: Colors.memoryLongTerm,
    title: '장기기억',
    desc: '14일 뒤에도 떠올릴 확률이 90% 이상인 단어예요. 확실히 외운 단어로 봐요.',
  },
  {
    color: Colors.memoryShortTerm,
    title: '단기기억',
    desc: '한 번 이상 복습했지만 아직 장기기억이 되지 않은 단어예요. 복습을 이어가면 장기기억이 돼요.',
  },
];

/** 범례마다 하나씩 둔다. 모달이라 루트 provider 로 올라가 어느 화면에서 열어도 맨 위에 뜬다. */
export const MemoryHelpSheet = React.memo(
  React.forwardRef<MemoryHelpSheetRef>(function MemoryHelpSheet(_props, ref) {
    const sheetRef = useRef<AppBottomSheetModalRef>(null);
    const [isOpen, setIsOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
    }), []);

    const handleClose = useCallback(() => {
      sheetRef.current?.dismiss();
    }, []);

    const handleChange = useCallback((index: number) => {
      setIsOpen(index >= 0);
    }, []);

    const handleDismiss = useCallback(() => {
      setIsOpen(false);
    }, []);

    useEffect(() => {
      if (!isOpen) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        sheetRef.current?.dismiss();
        return true;
      });
      return () => sub.remove();
    }, [isOpen]);

    return (
      <AppBottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        enablePanDownToClose
        onChange={handleChange}
        onDismiss={handleDismiss}
      >
        <AppBottomSheetView>
          <View style={styles.container}>
            <View style={styles.body}>
              <Text style={styles.title}>장기기억과 단기기억</Text>
              <View style={styles.items}>
                {HELP_ITEMS.map(item => (
                  <View key={item.title} style={styles.item}>
                    <View style={styles.itemHead}>
                      <View style={[styles.dot, { backgroundColor: item.color }]} />
                      <Text style={styles.itemTitle}>{item.title}</Text>
                    </View>
                    <Text style={styles.itemDesc}>{item.desc}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.ctaWrap}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleClose}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="확인"
              >
                <Text style={styles.confirmLabel}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </AppBottomSheetView>
      </AppBottomSheetModal>
    );
  }),
);

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  body: {
    gap: 20,
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  title: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
  },
  items: {
    gap: 14,
  },
  item: {
    gap: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSubtle,
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 9999,
  },
  itemTitle: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  itemDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  ctaWrap: {
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  confirmButton: {
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  confirmLabel: {
    ...Typography.bodySemiBold,
    color: '#FFFFFF',
    fontSize: 14,
  },
});
