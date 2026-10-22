import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
/** md: 시트·다이얼로그 안, lg: 화면 하단 고정 CTA. */
export type ButtonSize = 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const FOREGROUND: Record<ButtonVariant, string> = {
  primary: '#FFFFFF',
  secondary: Colors.textSecondary,
  danger: '#FFFFFF',
};

export const Button = React.memo(function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: Props) {
  const color = FOREGROUND[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        styles[variant],
        disabled && !loading && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 18 : 16} color={color} /> : null}
          <Text style={[styles.label, size === 'lg' && styles.labelLg, { color }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: 9999,
  },
  md: { height: 44 },
  lg: { height: 48 },
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.elevated },
  danger: { backgroundColor: Colors.accentRed },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  label: {
    ...Typography.bodyExtraBold,
    fontSize: 14,
    lineHeight: 19,
  },
  labelLg: {
    fontSize: 15,
    lineHeight: 20,
  },
});
