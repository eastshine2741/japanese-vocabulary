import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FlashcardDTO } from '../types/flashcard';
import { Colors } from '../theme/theme';
import { JlptBadge, PosBadge } from './Badges';
import ArtworkImage from './ArtworkImage';

interface Props {
  card: FlashcardDTO;
}

/**
 * Renders the back-side details (reading, badges, meaning, examples).
 * Kanji is rendered separately by ReviewScreen to keep its position fixed.
 */
export default function FlashcardBackDetails({ card }: Props) {
  return (
    <View style={styles.container}>
      {card.reading && <Text style={styles.reading}>{card.reading}</Text>}

      {card.meanings.length > 0 && (
        <View style={styles.badgesRow}>
          {[...new Set(card.meanings.map(m => m.partOfSpeech))].map((pos, i) => (
            <PosBadge key={i} pos={pos} />
          ))}
        </View>
      )}

      {card.meanings.length > 0 && (
        <Text style={styles.korean}>{card.meanings.map(m => m.text).join(', ')}</Text>
      )}

      {card.examples.length > 0 && (
        <View style={styles.exampleCarousel}>
          {card.examples[0].lyricLine && (
            <Text style={styles.jpText}>{card.examples[0].lyricLine}</Text>
          )}
          {card.examples[0].songTitle && (
            <View style={styles.songRow}>
              <ArtworkImage url={card.examples[0].artworkUrl} size={18} cornerRadius={4} />
              <Text style={styles.songLabel}>{card.examples[0].songTitle}</Text>
            </View>
          )}
          {card.examples.length > 1 && (
            <View style={styles.pageDots}>
              {card.examples.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pageDot,
                    i === 0
                      ? { width: 6, height: 6, backgroundColor: Colors.textSecondary }
                      : { width: 5, height: 5, backgroundColor: '#D4D4D8' },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  reading: {
    fontSize: 20,
    color: Colors.textSecondary,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  korean: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  exampleCarousel: {
    paddingTop: 20,
    gap: 4,
    alignItems: 'center',
    width: '100%',
  },
  jpText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  songLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingTop: 4,
  },
  pageDot: {
    borderRadius: 100,
  },
});
