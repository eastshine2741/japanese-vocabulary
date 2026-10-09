import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { fontStyle } from '../../theme/typography';

interface Props {
  enabled: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export const KaraokeNotifyToggle = React.memo(function KaraokeNotifyToggle({
  enabled,
  onPress,
  disabled = false,
}: Props) {
  const tint = enabled ? '#FFFFFF' : Colors.textSecondary;
  return (
    <TouchableOpacity
      style={[styles.pill, enabled ? styles.pillOn : styles.pillOff]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.72}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled }}
    >
      <Ionicons
        name={enabled ? 'notifications' : 'notifications-outline'}
        size={14}
        color={tint}
      />
      <Text style={[styles.label, { color: tint }]}>{enabled ? '알림 켜짐' : '알림 받기'}</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  pillOff: {
    backgroundColor: Colors.surfaceSubtle,
  },
  pillOn: {
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize: 12,
    lineHeight: 17,
    ...fontStyle('body', '600'),
  },
});
