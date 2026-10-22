import React from 'react';
import { AccessibilityRole, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 품사·JLPT 처럼 값마다 색이 있는 칩. 없으면 primary. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  /** 하나만 고르는 묶음이면 'radio'. */
  accessibilityRole?: AccessibilityRole;
}

export const Chip = React.memo(function Chip({ label, selected, onPress, tint = Colors.primary, style, accessibilityRole = 'button' }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        selected && { borderColor: tint, backgroundColor: `${tint}20` },
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected }}
    >
      <Text style={[styles.label, selected && [styles.labelSelected, { color: tint }]]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: Colors.surfaceSubtle,
  },
  pressed: { opacity: 0.7 },
  label: {
    ...Typography.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  labelSelected: Typography.bodyExtraBold,
});
