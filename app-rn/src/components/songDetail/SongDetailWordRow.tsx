import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { getPosColor, getPosLabel } from '../../types/pos';
import { convertReading } from '../../utils/readingConverter';
import { useSettingsStore } from '../../stores/settingsStore';
import { SongDetailWordItem } from './types';

interface Props {
  word: SongDetailWordItem;
  isSaved: boolean;
  isBusy: boolean;
  onToggleSave: (word: SongDetailWordItem) => void;
}

function SongDetailWordRow({ word, isSaved, isBusy, onToggleSave }: Props) {
  const readingDisplay = useSettingsStore(s => s.readingDisplay);
  const handleToggle = useCallback(() => {
    onToggleSave(word);
  }, [onToggleSave, word]);

  const posLabel = word.partOfSpeechLabel ?? getPosLabel(word.partOfSpeech);
  const posColor = getPosColor(word.partOfSpeech);
  const reading = word.reading ? convertReading(word.reading, readingDisplay) : '';
  const jlptColor = getJlptColor(word.jlpt);

  return (
    <View style={styles.row}>
      <View style={styles.wordInfo}>
        <View style={styles.jpRow}>
          <Text style={styles.japanese} numberOfLines={1}>{word.baseForm || word.japanese || word.surface}</Text>
          {reading !== '' && <Text style={styles.reading} numberOfLines={1}>{reading}</Text>}
        </View>
        <View style={styles.meaningRow}>
          <Text style={styles.meaning} numberOfLines={1}>
            {word.koreanText ?? '뜻 정보가 없습니다'}
          </Text>
          <View style={styles.badges}>
            {word.jlpt && (
              <View style={[styles.badge, { backgroundColor: jlptColor }]}>
                <Text style={styles.jlptText}>{word.jlpt}</Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: `${posColor}20` }]}>
              <Text style={[styles.posText, { color: posColor }]}>{posLabel}</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.toggleButton, isSaved && styles.toggleButtonSaved]}
        onPress={handleToggle}
        disabled={isBusy}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isSaved ? '단어장에서 빼기' : '단어 담기'}
      >
        {isBusy ? (
          <ActivityIndicator size="small" color={isSaved ? '#FFFFFF' : Colors.primary} />
        ) : (
          <Feather
            name="bookmark"
            size={17}
            color={isSaved ? '#FFFFFF' : Colors.textSecondary}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(SongDetailWordRow);

function getJlptColor(jlpt: string | null): string {
  switch (jlpt) {
    case 'N1':
      return Colors.jlptN1;
    case 'N2':
      return Colors.jlptN2;
    case 'N3':
      return Colors.jlptN3;
    case 'N4':
      return Colors.jlptN4;
    case 'N5':
      return Colors.jlptN5;
    default:
      return Colors.textMuted;
  }
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  wordInfo: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  jpRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    minWidth: 0,
  },
  japanese: {
    maxWidth: '58%',
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  reading: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  meaningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  meaning: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badge: {
    minHeight: 22,
    justifyContent: 'center',
    borderRadius: 9999,
    paddingHorizontal: 7,
  },
  jlptText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  posText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.elevated,
  },
  toggleButtonSaved: {
    backgroundColor: Colors.primary,
  },
});
