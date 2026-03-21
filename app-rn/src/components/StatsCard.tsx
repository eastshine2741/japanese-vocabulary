import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Dimens } from '../theme/theme';

interface Props {
  wordCount: number;
  dueToday: number;
  actionLabel: string;
  onAction: () => void;
}

export default function StatsCard({ wordCount, dueToday, actionLabel, onAction }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{wordCount}</Text>
          <Text style={styles.statLabel}>total words</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{dueToday}</Text>
          <Text style={styles.statLabel}>due today</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.button} onPress={onAction} activeOpacity={0.7}>
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Dimens.cardCornerRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statsRow: { flexDirection: 'row', marginBottom: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});
