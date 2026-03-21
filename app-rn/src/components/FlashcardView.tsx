import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashcardDTO } from '../types/flashcard';
import { Colors, Dimens } from '../theme/theme';

interface Props {
  card: FlashcardDTO;
  isRevealed: boolean;
  onReveal: () => void;
}

export default function FlashcardView({ card, isRevealed, onReveal }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={!isRevealed ? onReveal : undefined}
      activeOpacity={isRevealed ? 1 : 0.7}
    >
      {!isRevealed ? (
        <View style={styles.front}>
          <Text style={styles.kanji}>{card.japanese}</Text>
          <Text style={styles.hint}>Tap to reveal</Text>
        </View>
      ) : (
        <View style={styles.back}>
          {card.reading && <Text style={styles.reading}>{card.reading}</Text>}
          <Text style={styles.kanjiBack}>{card.japanese}</Text>
          {card.koreanText && <Text style={styles.korean}>{card.koreanText}</Text>}
          {card.examples.length > 0 && (
            <View style={styles.examples}>
              {card.examples.map((ex, i) => (
                <View key={i} style={styles.example}>
                  {ex.lyricLine && (
                    <Text style={styles.lyricLine}>{ex.lyricLine}</Text>
                  )}
                  {ex.songTitle && (
                    <Text style={styles.songTitle}>{ex.songTitle}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Dimens.cardCornerRadius,
    padding: 24,
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  front: { alignItems: 'center' },
  kanji: { fontSize: 40, fontWeight: '700', color: Colors.textPrimary },
  hint: { fontSize: 14, color: Colors.textTertiary, marginTop: 16 },
  back: { alignItems: 'center', width: '100%' },
  reading: { fontSize: 16, color: Colors.textSecondary, marginBottom: 4 },
  kanjiBack: { fontSize: 36, fontWeight: '700', color: Colors.textPrimary },
  korean: { fontSize: 20, fontWeight: '600', color: Colors.textPrimary, marginTop: 12 },
  examples: { marginTop: 20, width: '100%' },
  example: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  lyricLine: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  songTitle: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: 2 },
});
