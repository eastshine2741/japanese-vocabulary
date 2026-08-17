import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { getPosColor, getPosLabel } from '../../types/pos';
import { convertReading } from '../../utils/readingConverter';
import { useSettingsStore } from '../../stores/settingsStore';

export interface SongDetailWordRowItem {
  japanese?: string;
  surface?: string;
  baseForm?: string | null;
  reading?: string | null;
  baseFormReading?: string | null;
  koreanText?: string | null;
  senses?: { meaning: string }[];
  partOfSpeech?: string | null;
  partOfSpeechLabel?: string | null;
  jlpt?: string | null;
}

interface Props<T extends SongDetailWordRowItem> {
  word: T;
  isSaved?: boolean;
  isBusy?: boolean;
  showDivider?: boolean;
  onToggleSave?: (word: T) => void;
}

function SongDetailWordRow<T extends SongDetailWordRowItem>({
  word,
  isSaved = false,
  isBusy = false,
  showDivider = true,
  onToggleSave,
}: Props<T>) {
  const readingDisplay = useSettingsStore(s => s.readingDisplay);
  const handleToggle = useCallback(() => {
    onToggleSave?.(word);
  }, [onToggleSave, word]);

  const pos = word.partOfSpeech ?? '';
  const posLabel = word.partOfSpeechLabel ?? (pos ? getPosLabel(pos) : '');
  const posColor = getPosColor(pos);
  const label = word.baseForm || word.japanese || word.surface || '';
  const readingValue = word.baseFormReading ?? word.reading;
  const reading = readingValue ? convertReading(readingValue, readingDisplay) : '';
  const meaning = word.senses?.map(item => item.meaning).filter(Boolean).join(', ')
    || word.koreanText
    || '';
  const jlptColor = getJlptColor(word.jlpt);

  return (
    <View style={[styles.row, showDivider && styles.rowDivider]}>
      <View style={styles.wordInfo}>
        <View style={styles.jpRow}>
          <Text style={styles.japanese} numberOfLines={1}>{label}</Text>
          {reading !== '' && <Text style={styles.reading} numberOfLines={1}>{reading}</Text>}
        </View>
        <View style={styles.meaningRow}>
          <Text style={styles.meaning} numberOfLines={1}>
            {meaning || '뜻 정보가 없습니다'}
          </Text>
          <View style={styles.badges}>
            {word.jlpt && (
              <View style={[styles.badge, { backgroundColor: `${jlptColor}20` }]}>
                <Text style={[styles.jlptText, { color: jlptColor }]}>{word.jlpt}</Text>
              </View>
            )}
            {posLabel !== '' && (
              <View style={[styles.badge, { backgroundColor: `${posColor}20` }]}>
                <Text style={[styles.posText, { color: posColor }]}>{posLabel}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.toggleButton}
        onPress={handleToggle}
        disabled={isBusy || onToggleSave == null}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isSaved ? '단어 상세로 이동' : '단어 담기'}
        accessibilityHint={isSaved ? '뜻과 예문을 수정할 수 있는 단어 상세화면을 엽니다' : undefined}
      >
        {isBusy ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Ionicons
            name={isSaved ? 'chevron-forward' : 'bookmark-outline'}
            size={17}
            color={Colors.primary}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(SongDetailWordRow) as typeof SongDetailWordRow;

function getJlptColor(jlpt: string | null | undefined): string {
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
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  wordInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  jpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  japanese: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  reading: {
    flexShrink: 1,
    fontSize: 12,
    color: Colors.textMuted,
  },
  meaningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  meaning: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badge: {
    height: 18,
    justifyContent: 'center',
    borderRadius: 9999,
    paddingTop: 1,
    paddingRight: 8,
    paddingBottom: 3,
    paddingLeft: 8,
  },
  jlptText: {
    fontSize: 10,
    fontWeight: '700',
  },
  posText: {
    fontSize: 10,
    fontWeight: '600',
  },
  toggleButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryBg,
  },
});
