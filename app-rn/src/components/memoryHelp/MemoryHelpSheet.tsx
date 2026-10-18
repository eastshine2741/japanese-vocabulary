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
    desc: '14일 뒤에도 떠올릴 확률이 90% 이상인 단어예요.',
  },
  {
    color: Colors.memoryShortTerm,
    title: '단기기억',
    desc: '한 번 이상 복습했지만 아직 장기기억이 되지 않은 단어예요.',
  },
];

const LONG_TERM_STEPS: string[] = [
  "복습할 때가 될 때마다 맞혀요. '알고 있음'으로 2~3주 동안 4번쯤 맞히면 장기기억이 돼요.",
  "잊었으면 '다시'를 눌러요. 곧 다시 나와서 바로 익힐 수 있어요. 모르는데 '알고 있음'을 누르면 며칠 뒤에야 다시 나와요.",
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
              <View style={styles.steps}>
                <Text style={styles.stepsTitle}>장기기억으로 만들려면</Text>
                {LONG_TERM_STEPS.map((step, index) => (
                  <View key={step} style={styles.step}>
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                    <Text style={styles.stepText}>{step}</Text>
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
  steps: {
    gap: 10,
  },
  stepsTitle: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  step: {
    flexDirection: 'row',
    gap: 10,
  },
  stepNumber: {
    ...Typography.bodyBold,
    width: 20,
    height: 20,
    borderRadius: 9999,
    overflow: 'hidden',
    textAlign: 'center',
    color: '#FFFFFF',
    backgroundColor: Colors.memoryLongTerm,
    fontSize: 12,
    lineHeight: 20,
  },
  stepText: {
    ...Typography.body,
    flex: 1,
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
