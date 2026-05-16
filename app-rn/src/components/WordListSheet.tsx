import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
// Use RNGH ScrollView so the horizontal chip strip composes correctly
// with the BottomSheet's gesture handler (RN's ScrollView gets its
// horizontal pan stolen by the sheet's vertical drag handler).
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { StudyUnit } from '../types/song';
import { AddWordRequest } from '../types/word';
import { POS_INFO } from '../types/pos';
import ReadingText from './ReadingText';
import { Colors } from '../theme/theme';

interface UniqueWord {
  baseForm: string;
  reading: string;
  koreanText: string | null;
  partOfSpeech: string;
  lineText: string;
  koreanLyrics: string | null;
}

// Row component — memoized so toggling one checkbox doesn't re-render
// every visible row. Receives a stable `onToggle` and a single `isChecked`
// boolean (instead of the whole `uncheckedWords` Set) so React.memo can
// skip rows whose checked state didn't change.
interface WordRowProps {
  item: UniqueWord;
  isChecked: boolean;
  onToggle: (baseForm: string) => void;
}

interface FilterChipProps {
  pos: string;
  isOn: boolean;
  color: string;
  label: string;
  onToggle: (pos: string) => void;
}

const FilterChip = React.memo(function FilterChip({ pos, isOn, color, label, onToggle }: FilterChipProps) {
  const handlePress = useCallback(() => onToggle(pos), [onToggle, pos]);
  return (
    <TouchableOpacity
      style={[styles.filterChip, isOn && { backgroundColor: color + '20' }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterChipText, isOn && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
});

const WordRow = React.memo(function WordRow({ item, isChecked, onToggle }: WordRowProps) {
  const handlePress = useCallback(() => onToggle(item.baseForm), [onToggle, item.baseForm]);
  const posInfo = POS_INFO[item.partOfSpeech];
  return (
    <TouchableOpacity style={styles.wordItem} onPress={handlePress} activeOpacity={0.6}>
      <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
        {isChecked && <Feather name="check" size={14} color="#FFFFFF" />}
      </View>
      <View style={styles.wordInfo}>
        <View style={styles.wordTexts}>
          <Text style={styles.wordJapanese}>{item.baseForm}</Text>
          {item.reading !== '' && (
            <ReadingText style={styles.wordReading} reading={item.reading} />
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
});

interface Props {
  studyUnits: StudyUnit[];
  songId: number;
  batchAddStatus: string;
  batchSavedCount: number;
  batchSkippedCount: number;
  onSave: (words: AddWordRequest[]) => void;
  // Animated sheet position: 0 = peek, 1 = expanded.
  animatedIndex: SharedValue<number>;
  // Discrete snap (for pointerEvents). 0 = peek, 1 = expanded.
  snapIndex: number;
  // Expanded snap height in px. Needed because BottomSheetView is
  // `position:absolute` without a bottom anchor — without an explicit height
  // its absolute children (the list wrapper) collapse to 0.
  contentHeight: number;
}

const DEFAULT_ON_POS = new Set(['NOUN', 'VERB', 'ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB']);
const HIDDEN_POS = new Set(['SYMBOL', 'SUPPLEMENTARY_SYMBOL', 'WHITESPACE']);

const FILTER_POS_ORDER = [
  'NOUN', 'VERB', 'ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB',
  'PRONOUN', 'AUXILIARY_VERB', 'CONJUNCTION', 'ADNOMINAL',
  'INTERJECTION', 'PARTICLE', 'PREFIX', 'SUFFIX',
];

function WordListSheet({
  studyUnits,
  songId,
  batchAddStatus,
  batchSavedCount,
  batchSkippedCount,
  onSave,
  animatedIndex,
  snapIndex,
  contentHeight,
}: Props) {
  const [enabledPOS, setEnabledPOS] = useState<Set<string>>(() => new Set(DEFAULT_ON_POS));
  const [uncheckedWords, setUncheckedWords] = useState<Set<string>>(new Set());

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

  const availablePOS = useMemo(() => {
    const posSet = new Set(allUniqueWords.map(w => w.partOfSpeech));
    return FILTER_POS_ORDER.filter(pos => posSet.has(pos));
  }, [allUniqueWords]);

  const filteredWords = useMemo(
    () => allUniqueWords.filter(w => enabledPOS.has(w.partOfSpeech)),
    [allUniqueWords, enabledPOS],
  );

  const checkedCount = filteredWords.filter(w => !uncheckedWords.has(w.baseForm)).length;

  const togglePOS = useCallback((pos: string) => {
    setEnabledPOS(prev => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos); else next.add(pos);
      return next;
    });
  }, []);

  const toggleWord = useCallback((baseForm: string) => {
    setUncheckedWords(prev => {
      const next = new Set(prev);
      if (next.has(baseForm)) next.delete(baseForm); else next.add(baseForm);
      return next;
    });
  }, []);

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

  const isLoading = batchAddStatus === 'loading';
  const isSuccess = batchAddStatus === 'success';

  const renderItem = useCallback(({ item }: { item: UniqueWord }) => (
    <WordRow
      item={item}
      isChecked={!uncheckedWords.has(item.baseForm)}
      onToggle={toggleWord}
    />
  ), [uncheckedWords, toggleWord]);

  const keyExtractor = useCallback((item: UniqueWord) => item.baseForm, []);

  // Sticky sheet header (drag handle + title + CTA + filter chips). Rendered
  // OUTSIDE the FlatList so it doesn't scroll with the word rows.
  const stickyHeader = (
    <View style={styles.stickyHeader}>
      <View style={styles.handleArea}>
        <View style={styles.handleIndicator} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>단어</Text>
          <Text style={styles.headerTotal}>{allUniqueWords.length}개</Text>
        </View>
        {isSuccess ? (
          <View style={[styles.ctaPill, styles.ctaPillSuccess]}>
            <Feather name="check" size={14} color="#FFFFFF" />
            <Text style={styles.ctaPillText}>
              {batchSavedCount}개 저장
              {batchSkippedCount > 0 ? ` (${batchSkippedCount}개 중복)` : ''}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.ctaPill, checkedCount === 0 && styles.ctaPillDisabled]}
            onPress={handleSave}
            disabled={isLoading || checkedCount === 0}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Feather name="plus" size={14} color="#FFFFFF" />
                <Text style={styles.ctaPillText}>{checkedCount}개 담기</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {availablePOS.map(pos => {
          const info = POS_INFO[pos];
          if (!info) return null;
          return (
            <FilterChip
              key={pos}
              pos={pos}
              isOn={enabledPOS.has(pos)}
              color={info.color}
              label={info.korean}
              onToggle={togglePOS}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  // Cross-fade peek → word list near the start of the drag so a tiny
  // pull from peek immediately reveals the list. Peek fully gone by 0.1,
  // list fully visible by 0.2 (small overlap to avoid a blank frame).
  const peekStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0, 0.1], [1, 0], Extrapolation.CLAMP),
  }));
  const listStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0.05, 0.2], [0, 1], Extrapolation.CLAMP),
  }));

  // NOTE: do NOT wrap in `BottomSheetView` — it registers itself as
  // `SCROLLABLE_TYPE.VIEW` on focus, which overrides the FlatList's
  // FLATLIST registration (parent effects run after children) and disables
  // scrolling for the sheet's content. A plain View is fine.
  return (
    <View style={[styles.root, { height: contentHeight }]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.listColumn, listStyle]}
        pointerEvents={snapIndex >= 1 ? 'auto' : 'none'}
      >
        {stickyHeader}
        <BottomSheetFlatList
          data={filteredWords}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
        />
      </Animated.View>

      <Animated.View
        style={[styles.peekOverlay, peekStyle]}
        pointerEvents={snapIndex === 0 ? 'auto' : 'none'}
      >
        <View style={styles.handleIndicator} />
        <Text style={styles.peekLabel}>단어</Text>
      </Animated.View>
    </View>
  );
}

export default React.memo(WordListSheet);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Animated.View wrapper holding sticky header + scrollable list. Needs
  // flex column so BottomSheetFlatList (flex:1) takes the remaining height.
  listColumn: {
    flexDirection: 'column',
  },
  stickyHeader: {
    flexShrink: 0,
  },

  listContent: {
    paddingBottom: 32,
  },

  // Drag handle (rendered inside content; matches V2JqQC sheetPeek / N07HWp.rp8Od)
  handleArea: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
  },

  // Peek overlay — same handle position as the list's handleArea so the
  // indicator stays put during the cross-fade.
  peekOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 28,
    gap: 10,
    backgroundColor: Colors.background,
  },
  peekLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Header (title + CTA pill)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerTotal: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: Colors.primary,
  },
  ctaPillSuccess: {
    backgroundColor: Colors.ratingGood,
  },
  ctaPillDisabled: {
    opacity: 0.4,
  },
  ctaPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Filter chips
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Word list
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
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
});
