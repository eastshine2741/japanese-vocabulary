import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/theme';

const JLPT_COLORS: Record<string, string> = {
  N1: Colors.jlptN1,
  N2: Colors.jlptN2,
  N3: Colors.jlptN3,
  N4: Colors.jlptN4,
  N5: Colors.jlptN5,
};

const POS_COLORS: Record<string, string> = {
  '名詞': Colors.posNoun,
  '動詞': Colors.posVerb,
  '形容詞': Colors.posAdjective,
  '副詞': Colors.posAdverb,
  '助詞': Colors.posParticle,
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
  const color = POS_COLORS[pos] || Colors.primary;
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.badgeText, { color }]}>{pos}</Text>
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
