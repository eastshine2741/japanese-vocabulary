import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/theme';

interface Props {
  wordCount: number;
  dueToday: number;
  actionLabel: string;
  onAction: () => void;
}

export default function StatsCard({ wordCount, dueToday, actionLabel, onAction }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>오늘의 복습</Text>
      <Text style={styles.dueCount}>{dueToday}개</Text>
      <Text style={styles.subLabel}>오늘 복습할 단어</Text>
      <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.7}>
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  dueCount: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -2,
  },
  subLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
