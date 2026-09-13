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
  isBusy?: boolean;
  showDivider?: boolean;
  /** 이 단어로 복습 시작. 안 담긴 단어는 호출부가 담고 나서 연다. */
  onStartReview: (word: T) => void;
}

function SongDetailWordRow<T extends SongDetailWordRowItem>({
  word,
  isBusy = false,
  showDivider = true,
  onStartReview,
}: Props<T>) {
  const readingDisplay = useSettingsStore(s => s.readingDisplay);
  const handleStartReview = useCallback(() => {
    onStartReview(word);
  }, [onStartReview, word]);

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

  const wordInfo = (
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
  );

  return (
    <TouchableOpacity
      style={[styles.row, showDivider && styles.rowDivider]}
      onPress={handleStartReview}
      disabled={isBusy}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label} 복습 시작`}
    >
      {wordInfo}
      <View style={styles.chevronSlot}>
        {isBusy ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        )}
      </View>
    </TouchableOpacity>
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
  chevronSlot: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
