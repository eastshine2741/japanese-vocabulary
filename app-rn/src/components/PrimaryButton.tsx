import React from 'react';
import { Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

interface Props {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, icon, style, disabled }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {icon && <Ionicons name={icon} size={20} color="#FFFFFF" />}
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: 24,
    gap: 8,
    paddingHorizontal: 16,
    shadowColor: Colors.primaryShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
