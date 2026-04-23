import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FlashcardDTO } from '../types/flashcard';
import { Colors } from '../theme/theme';
import { convertReading } from '../utils/readingConverter';
import { useSettingsStore } from '../stores/settingsStore';
import { JlptBadge, PosBadge } from './Badges';
import ArtworkImage from './ArtworkImage';

interface Props {
  card: FlashcardDTO;
  onSongPress?: (songId: number, lyricLine: string | null) => void;
}

/**
 * Renders the back-side details (reading, badges, meaning, examples).
 * Kanji is rendered separately by ReviewScreen to keep its position fixed.
 */
export default function FlashcardBackDetails({ card, onSongPress }: Props) {
  const readingDisplay = useSettingsStore(s => s.readingDisplay);
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth - 48;
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setActiveIndex(idx);
  }, [pageWidth]);

  return (
    <View style={styles.container}>
      {card.reading && <Text style={styles.reading}>{convertReading(card.reading, readingDisplay)}</Text>}

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
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            snapToInterval={pageWidth}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 24 }}
            style={{ marginHorizontal: -24 }}
          >
            {card.examples.map((ex, i) => (
              <View key={i} style={[styles.exPage, { width: pageWidth }]}>
                {ex.lyricLine && (
                  <Text style={styles.jpText}>{ex.lyricLine}</Text>
                )}
                {ex.koreanLyricLine && (
                  <Text style={styles.krText}>{ex.koreanLyricLine}</Text>
                )}
                {ex.songTitle && (
                  <TouchableOpacity
                    style={styles.songRow}
                    onPress={onSongPress ? () => onSongPress(ex.songId, ex.lyricLine) : undefined}
                    disabled={!onSongPress}
                    activeOpacity={0.6}
                  >
                    <ArtworkImage url={ex.artworkUrl} size={18} cornerRadius={4} />
                    <Text style={styles.songLabel}>{ex.songTitle}</Text>
                    {onSongPress && <Feather name="play-circle" size={14} color={Colors.textMuted} />}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
          {card.examples.length > 1 && (
            <View style={styles.pageDots}>
              {card.examples.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pageDot,
                    i === activeIndex
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
  exPage: {
    gap: 4,
    alignItems: 'center',
  },
  jpText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  krText: {
    fontSize: 13,
    color: Colors.textMuted,
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
