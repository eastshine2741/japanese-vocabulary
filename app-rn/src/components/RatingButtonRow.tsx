import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme/theme';

interface Props {
  intervals: Record<number, string> | null;
  onRate: (rating: number) => void;
}

const RATINGS = [
  { rating: 1, label: '다시', color: Colors.ratingAgain, bg: Colors.ratingAgainBg },
  { rating: 2, label: '어려움', color: Colors.ratingHard, bg: Colors.ratingHardBg },
  { rating: 3, label: '보통', color: Colors.ratingGood, bg: Colors.ratingGoodBg },
  { rating: 4, label: '쉬움', color: Colors.ratingEasy, bg: Colors.ratingEasyBg },
];

function RatingButtonRow({ intervals, onRate }: Props) {
  return (
    <View style={styles.row}>
      {RATINGS.map(({ rating, label, color, bg }) => (
        <TouchableOpacity
          key={rating}
          style={[styles.button, { backgroundColor: bg }]}
          onPress={() => onRate(rating)}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, { color }]}>{label}</Text>
          {intervals?.[rating] && (
            <Text style={[styles.interval, { color, opacity: 0.7 }]}>
              {intervals[rating]}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default React.memo(RatingButtonRow);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontWeight: '600', fontSize: 14 },
  interval: { fontSize: 10 },
});
