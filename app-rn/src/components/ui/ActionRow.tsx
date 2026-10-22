import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

interface Props {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/** 액션 시트의 한 줄. */
export const ActionRow = React.memo(function ActionRow({ icon, label, onPress, destructive = false }: Props) {
  const color = destructive ? Colors.ratingAgain : Colors.textPrimary;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  pressed: { opacity: 0.6 },
  label: {
    ...Typography.bodySemiBold,
    fontSize: 15,
  },
});
