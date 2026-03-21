import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/theme';

interface Props {
  intervals: Record<number, string> | null;
  onRate: (rating: number) => void;
}

const RATINGS = [
  { rating: 1, label: 'Again', color: Colors.ratingAgain },
  { rating: 2, label: 'Hard', color: Colors.ratingHard },
  { rating: 3, label: 'Good', color: Colors.ratingGood },
  { rating: 4, label: 'Easy', color: Colors.ratingEasy },
];

export default function RatingButtonRow({ intervals, onRate }: Props) {
  return (
    <View style={styles.row}>
      {RATINGS.map(({ rating, label, color }) => (
        <TouchableOpacity
          key={rating}
          style={[styles.button, { backgroundColor: color }]}
          onPress={() => onRate(rating)}
          activeOpacity={0.7}
        >
          <Text style={styles.label}>{label}</Text>
          {intervals?.[rating] && (
            <Text style={styles.interval}>{intervals[rating]}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  label: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  interval: { color: '#FFFFFFCC', fontSize: 11, marginTop: 2 },
});
