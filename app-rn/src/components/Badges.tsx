import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { POS_INFO } from '../types/pos';
import { Colors } from '../theme/theme';

const JLPT_COLORS: Record<string, string> = {
  N1: Colors.jlptN1,
  N2: Colors.jlptN2,
  N3: Colors.jlptN3,
  N4: Colors.jlptN4,
  N5: Colors.jlptN5,
};

export function JlptBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const color = JLPT_COLORS[level] || Colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.badgeText, { color }]}>{level}</Text>
    </View>
  );
}

export function PosBadge({ pos }: { pos: string }) {
  const info = POS_INFO[pos];
  const color = info?.color ?? Colors.primary;
  const label = info?.korean ?? pos;
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
