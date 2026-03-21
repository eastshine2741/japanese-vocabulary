import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/theme';

const JLPT_COLORS: Record<string, string> = {
  N1: '#EF4444',
  N2: '#F59E0B',
  N3: '#10B981',
  N4: '#3B82F6',
  N5: '#8B5CF6',
};

export function JlptBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const bg = JLPT_COLORS[level] || Colors.textTertiary;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.badgeText}>{level}</Text>
    </View>
  );
}

export function PosBadge({ pos }: { pos: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: Colors.primary + '20' }]}>
      <Text style={[styles.badgeText, { color: Colors.primary }]}>{pos}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
