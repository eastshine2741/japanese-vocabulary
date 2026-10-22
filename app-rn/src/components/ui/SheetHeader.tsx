import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backAccessibilityLabel?: string;
  onClose?: () => void;
  closeAccessibilityLabel?: string;
}

export const SheetHeader = React.memo(function SheetHeader({
  title,
  subtitle,
  onBack,
  backAccessibilityLabel = '뒤로',
  onClose,
  closeAccessibilityLabel = '닫기',
}: Props) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          style={styles.iconButton}
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
        >
          <Feather name="chevron-left" size={18} color={Colors.textSecondary} />
        </Pressable>
      ) : null}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={subtitle ? 1 : 2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {onClose ? (
        <Pressable
          style={styles.iconButton}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={closeAccessibilityLabel}
        >
          <Feather name="x" size={16} color={Colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...Typography.headingExtraBold,
    fontSize: 19,
    lineHeight: 26,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSubtle,
  },
});
