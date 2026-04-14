import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StudyUnit } from '../types/song';
import { AddWordRequest } from '../types/word';
import { POS_INFO } from '../types/pos';
import { Colors } from '../theme/theme';

interface UniqueWord {
  baseForm: string;
  reading: string;
  koreanText: string | null;
  partOfSpeech: string;
  lineText: string;
  koreanLyrics: string | null;
}

interface Props {
  visible: boolean;
  studyUnits: StudyUnit[];
  songId: number;
  batchAddStatus: string;
  batchSavedCount: number;
  batchSkippedCount: number;
  onSave: (words: AddWordRequest[]) => void;
  onClose: () => void;
}

const DEFAULT_ON_POS = new Set(['NOUN', 'VERB', 'ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB']);
const HIDDEN_POS = new Set(['SYMBOL', 'SUPPLEMENTARY_SYMBOL', 'WHITESPACE']);

// POS categories visible in filter chips (ordered)
const FILTER_POS_ORDER = [
  'NOUN', 'VERB', 'ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB',
  'PRONOUN', 'AUXILIARY_VERB', 'CONJUNCTION', 'ADNOMINAL',
  'INTERJECTION', 'PARTICLE', 'PREFIX', 'SUFFIX',
];

export default function SongWordListSheet({
  visible,
  studyUnits,
  songId,
  batchAddStatus,
  batchSavedCount,
  batchSkippedCount,
  onSave,
  onClose,
}: Props) {
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets();
  const [enabledPOS, setEnabledPOS] = useState<Set<string>>(() => new Set(DEFAULT_ON_POS));
  const [uncheckedWords, setUncheckedWords] = useState<Set<string>>(new Set());

  // Flatten and dedup tokens by baseForm
  const allUniqueWords = useMemo(() => {
    const map = new Map<string, UniqueWord>();
    for (const unit of studyUnits) {
      for (const token of unit.tokens) {
        if (HIDDEN_POS.has(token.partOfSpeech)) continue;
        if (token.koreanText == null) continue;
        if (map.has(token.baseForm)) continue;
        map.set(token.baseForm, {
          baseForm: token.baseForm,
          reading: token.baseFormReading ?? token.reading ?? '',
          koreanText: token.koreanText,
          partOfSpeech: token.partOfSpeech,
          lineText: unit.originalText,
          koreanLyrics: unit.koreanLyrics,
        });
      }
    }
    return Array.from(map.values());
  }, [studyUnits]);

  // POS types that actually exist in the words
  const availablePOS = useMemo(() => {
    const posSet = new Set(allUniqueWords.map(w => w.partOfSpeech));
    return FILTER_POS_ORDER.filter(pos => posSet.has(pos));
  }, [allUniqueWords]);

  // Filtered words by POS
  const filteredWords = useMemo(
    () => allUniqueWords.filter(w => enabledPOS.has(w.partOfSpeech)),
    [allUniqueWords, enabledPOS],
  );

  // Checked words (visible minus unchecked)
  const checkedCount = filteredWords.filter(w => !uncheckedWords.has(w.baseForm)).length;

  const togglePOS = useCallback((pos: string) => {
    setEnabledPOS(prev => {
      const next = new Set(prev);
      if (next.has(pos)) {
        next.delete(pos);
      } else {
        next.add(pos);
      }
      return next;
    });
  }, []);

  const toggleWord = useCallback((baseForm: string) => {
    setUncheckedWords(prev => {
      const next = new Set(prev);
      if (next.has(baseForm)) {
        next.delete(baseForm);
      } else {
        next.add(baseForm);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setUncheckedWords(new Set());
  }, []);

  const deselectAll = useCallback(() => {
    setUncheckedWords(new Set(filteredWords.map(w => w.baseForm)));
  }, [filteredWords]);

  const handleSave = useCallback(() => {
    const words: AddWordRequest[] = filteredWords
      .filter(w => !uncheckedWords.has(w.baseForm))
      .map(w => ({
        japanese: w.baseForm,
        reading: w.reading,
        koreanText: w.koreanText ?? '',
        partOfSpeech: w.partOfSpeech,
        songId,
        lyricLine: w.lineText,
        koreanLyricLine: w.koreanLyrics ?? undefined,
      }));
    onSave(words);
  }, [filteredWords, uncheckedWords, songId, onSave]);

  const renderWordItem = useCallback(({ item }: { item: UniqueWord }) => {
    const isChecked = !uncheckedWords.has(item.baseForm);
    const posInfo = POS_INFO[item.partOfSpeech];

    return (
      <TouchableOpacity
        style={styles.wordItem}
        onPress={() => toggleWord(item.baseForm)}
        activeOpacity={0.6}
      >
        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
          {isChecked && <Feather name="check" size={14} color="#FFFFFF" />}
        </View>
        <View style={styles.wordInfo}>
          <View style={styles.wordTexts}>
            <Text style={styles.wordJapanese}>{item.baseForm}</Text>
            {item.reading !== '' && (
              <Text style={styles.wordReading}>{item.reading}</Text>
            )}
          </View>
          <Text style={styles.wordMeaning} numberOfLines={1}>{item.koreanText}</Text>
        </View>
        {posInfo && (
          <View style={[styles.posBadge, { backgroundColor: posInfo.color + '20' }]}>
            <Text style={[styles.posBadgeText, { color: posInfo.color }]}>{posInfo.korean}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [uncheckedWords, toggleWord]);

  const isLoading = batchAddStatus === 'loading';
  const isSuccess = batchAddStatus === 'success';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: safeTop }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>전체 단어</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.6} style={styles.closeBtn}>
            <Feather name="x" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* POS filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {availablePOS.map(pos => {
            const info = POS_INFO[pos];
            if (!info) return null;
            const isOn = enabledPOS.has(pos);
            return (
              <TouchableOpacity
                key={pos}
                style={[styles.filterChip, isOn && styles.filterChipActive]}
                onPress={() => togglePOS(pos)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isOn && styles.filterChipTextActive]}>
                  {info.korean}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Select all / Deselect all */}
        <View style={styles.selectionBar}>
          <Text style={styles.selectionCount}>{filteredWords.length}개 단어</Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={selectAll} activeOpacity={0.6}>
              <Text style={styles.selectionLink}>전체 선택</Text>
            </TouchableOpacity>
            <Text style={styles.selectionDot}>·</Text>
            <TouchableOpacity onPress={deselectAll} activeOpacity={0.6}>
              <Text style={styles.selectionLink}>전체 해제</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Word list */}
        <FlatList
          data={filteredWords}
          keyExtractor={item => item.baseForm}
          renderItem={renderWordItem}
          contentContainerStyle={styles.listContent}
          style={styles.list}
        />

        {/* CTA */}
        <View style={[styles.ctaArea, { paddingBottom: safeBottom + 16 }]}>
          {isSuccess ? (
            <View style={[styles.ctaBtn, styles.ctaBtnSuccess]}>
              <Feather name="check" size={18} color="#FFFFFF" />
              <Text style={styles.ctaBtnText}>
                {batchSavedCount}개 저장 완료{batchSkippedCount > 0 ? ` (${batchSkippedCount}개 이미 존재)` : ''}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.ctaBtn, styles.ctaBtnPrimary, checkedCount === 0 && styles.ctaBtnDisabled]}
              onPress={handleSave}
              activeOpacity={0.7}
              disabled={isLoading || checkedCount === 0}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Feather name="plus" size={18} color="#FFFFFF" />
                  <Text style={styles.ctaBtnText}>{checkedCount}개 단어 담기</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // POS filter
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // Selection bar
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  selectionCount: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionLink: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primary,
  },
  selectionDot: {
    fontSize: 13,
    color: Colors.textMuted,
  },

  // Word list
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  wordInfo: {
    flex: 1,
    gap: 2,
  },
  wordTexts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  wordJapanese: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  wordReading: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  wordMeaning: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  posBadge: {
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  posBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // CTA
  ctaArea: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 26,
    gap: 8,
  },
  ctaBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  ctaBtnSuccess: {
    backgroundColor: '#10B981',
  },
  ctaBtnDisabled: {
    opacity: 0.4,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
