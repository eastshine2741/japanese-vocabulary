import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { wordApi } from '../../api/wordApi';
import { AppBottomSheetModal, AppBottomSheetModalRef } from '../bottomSheet';
import { Colors } from '../../theme/theme';
import SongDetailWordRow from './SongDetailWordRow';
import SongDetailSortSheet from './SongDetailSortSheet';
import SongDetailFilterSheet from './SongDetailFilterSheet';
import { getSongDetailWordKey } from './songDetailWordSave';
import {
  SongDetailWordItem,
  SongDetailWordSaveState,
  SongDetailWordsSort,
  WordsInSongDto,
} from './types';

const DEFAULT_POS = ['NOUN', 'VERB', 'ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB'];
const INITIAL_WORD_RENDER_COUNT = 18;
const WORD_RENDER_CHUNK_SIZE = 24;
const POS_ORDER = [
  'NOUN',
  'VERB',
  'ADJECTIVE',
  'NA_ADJECTIVE',
  'ADVERB',
  'PRONOUN',
  'ADNOMINAL',
  'CONJUNCTION',
  'AUXILIARY_VERB',
  'PARTICLE',
  'INTERJECTION',
  'PREFIX',
  'SUFFIX',
  'EXPRESSION',
];
const JLPT_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];

interface Props {
  data: WordsInSongDto | null;
  isActive?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  bottomPadding?: number;
  onWordsChanged?: () => void;
  getWordSaveState: (word: SongDetailWordItem) => SongDetailWordSaveState;
  busyWordKey: string | null;
  onToggleWordSave: (word: SongDetailWordItem) => void;
  onWordsBatchAdded: (words: SongDetailWordItem[]) => void;
}

interface SummaryChipProps {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}

const SummaryChip = React.memo(function SummaryChip({ icon, onPress }: SummaryChipProps) {
  return (
    <TouchableOpacity
      style={styles.summaryChip}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <Feather name={icon} size={12} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
});

function getInitialPos(data: WordsInSongDto | null): Set<string> {
  const configured = data?.filterDefaults?.pos;
  if (configured && configured.length > 0) return new Set(configured);
  return new Set(DEFAULT_POS);
}

function getInitialJlpt(data: WordsInSongDto | null): Set<string> {
  const configured = data?.filterDefaults?.jlpt;
  return configured && configured.length > 0 ? new Set(configured) : new Set(JLPT_ORDER);
}

function getInitialIncludeUnknownJlpt(data: WordsInSongDto | null): boolean {
  return data?.filterDefaults?.includeUnknownJlpt ?? true;
}

function getInitialSort(data: WordsInSongDto | null): SongDetailWordsSort {
  return data?.filterDefaults?.sortDefault?.toUpperCase() === 'APPEARANCE' ? 'appearance' : 'importance';
}

export default function SongDetailWordsTab({
  data,
  isActive = true,
  isLoading = false,
  errorMessage = null,
  bottomPadding = 150,
  onWordsChanged,
  getWordSaveState,
  busyWordKey,
  onToggleWordSave,
  onWordsBatchAdded,
}: Props) {
  const insets = useSafeAreaInsets();
  const sortSheetRef = useRef<AppBottomSheetModalRef>(null);
  const filterSheetRef = useRef<AppBottomSheetModalRef>(null);
  const [sort, setSort] = useState<SongDetailWordsSort>(() => getInitialSort(data));
  const [selectedPos, setSelectedPos] = useState<Set<string>>(() => getInitialPos(data));
  const [selectedJlpt, setSelectedJlpt] = useState<Set<string>>(() => getInitialJlpt(data));
  const [includeUnknownJlpt, setIncludeUnknownJlpt] = useState(() => getInitialIncludeUnknownJlpt(data));
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [renderLimit, setRenderLimit] = useState(INITIAL_WORD_RENDER_COUNT);

  const words = data?.words ?? [];
  const filterDefaultsKey = useMemo(() => {
    const defaults = data?.filterDefaults;
    return [
      defaults?.sortDefault ?? '',
      defaults?.includeUnknownJlpt ? '1' : '0',
      (defaults?.pos ?? []).join(','),
      (defaults?.jlpt ?? []).join(','),
    ].join('|');
  }, [data?.filterDefaults]);

  useEffect(() => {
    setSort(getInitialSort(data));
    setSelectedPos(getInitialPos(data));
    setSelectedJlpt(getInitialJlpt(data));
    setIncludeUnknownJlpt(getInitialIncludeUnknownJlpt(data));
  }, [filterDefaultsKey]);

  const availablePos = useMemo(() => {
    const present = new Set(words.map(word => word.partOfSpeech));
    const ordered = POS_ORDER.filter(pos => present.has(pos));
    const extras = Array.from(present).filter(pos => !POS_ORDER.includes(pos)).sort();
    return [...ordered, ...extras];
  }, [words]);

  const availableJlpt = useMemo(() => {
    const present = new Set(words.map(word => word.jlpt).filter((jlpt): jlpt is string => jlpt != null));
    const ordered = JLPT_ORDER.filter(jlpt => present.has(jlpt));
    const extras = Array.from(present).filter(jlpt => !JLPT_ORDER.includes(jlpt)).sort();
    return [...ordered, ...extras];
  }, [words]);

  const visibleWords = useMemo(() => {
    const filtered = words.filter(word => {
      const matchesPos = selectedPos.has(word.partOfSpeech);
      const matchesJlpt = word.jlpt == null
        ? includeUnknownJlpt
        : selectedJlpt.has(word.jlpt);
      return matchesPos && matchesJlpt;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'appearance') return a.appearanceOrder - b.appearanceOrder;
      const importanceDiff = b.importanceScore - a.importanceScore;
      return importanceDiff !== 0 ? importanceDiff : a.appearanceOrder - b.appearanceOrder;
    });
  }, [includeUnknownJlpt, words, selectedPos, selectedJlpt, sort]);

  useEffect(() => {
    setRenderLimit(Math.min(INITIAL_WORD_RENDER_COUNT, visibleWords.length));
  }, [visibleWords]);

  useEffect(() => {
    if (!isActive || visibleWords.length <= INITIAL_WORD_RENDER_COUNT) return;

    let cancelled = false;
    let frame: number | null = null;
    let idleCallback: number | null = requestIdleCallback(() => {
      const grow = () => {
        if (cancelled) return;
        setRenderLimit(prev => {
          const next = Math.min(prev + WORD_RENDER_CHUNK_SIZE, visibleWords.length);
          if (next < visibleWords.length) {
            frame = requestAnimationFrame(grow);
          }
          return next;
        });
      };
      frame = requestAnimationFrame(grow);
      idleCallback = null;
    }, { timeout: 180 });

    return () => {
      cancelled = true;
      if (idleCallback != null) cancelIdleCallback(idleCallback);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [isActive, visibleWords]);

  const renderedWords = useMemo(
    () => visibleWords.slice(0, Math.min(renderLimit, visibleWords.length)),
    [renderLimit, visibleWords],
  );

  const batchCandidates = useMemo(
    () => visibleWords.filter(word => !getWordSaveState(word).isSavedForSong),
    [getWordSaveState, visibleWords],
  );
  const batchCount = batchCandidates.length;

  const openSortSheet = useCallback(() => {
    sortSheetRef.current?.present();
  }, []);

  const openFilterSheet = useCallback(() => {
    filterSheetRef.current?.present();
  }, []);

  const closeSortSheet = useCallback(() => {
    sortSheetRef.current?.dismiss();
  }, []);

  const closeFilterSheet = useCallback(() => {
    filterSheetRef.current?.dismiss();
  }, []);

  const handleSortApply = useCallback((value: SongDetailWordsSort) => {
    setSort(value);
    sortSheetRef.current?.dismiss();
  }, []);

  const togglePos = useCallback((pos: string) => {
    setSelectedPos(prev => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos); else next.add(pos);
      return next;
    });
  }, []);

  const toggleJlpt = useCallback((jlpt: string) => {
    setSelectedJlpt(prev => {
      const next = new Set(prev);
      if (next.has(jlpt)) next.delete(jlpt); else next.add(jlpt);
      return next;
    });
  }, []);

  const toggleUnknownJlpt = useCallback(() => {
    setIncludeUnknownJlpt(prev => !prev);
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedPos(getInitialPos(data));
    setSelectedJlpt(getInitialJlpt(data));
    setIncludeUnknownJlpt(getInitialIncludeUnknownJlpt(data));
  }, [data]);

  const applyFilters = useCallback(() => {
    filterSheetRef.current?.dismiss();
  }, []);

  const handleBatchAdd = useCallback(async () => {
    if (batchCandidates.length === 0 || isBatchSaving) return;
    setIsBatchSaving(true);
    try {
      await wordApi.batchAddWords({ words: batchCandidates.map(word => word.addRequest) });
      onWordsBatchAdded(batchCandidates);
      onWordsChanged?.();
    } finally {
      setIsBatchSaving(false);
    }
  }, [batchCandidates, isBatchSaving, onWordsBatchAdded, onWordsChanged]);

  const listEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.stateView}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      );
    }
    if (errorMessage != null) {
      return (
        <View style={styles.stateView}>
          <Text style={styles.stateTitle}>단어를 불러오지 못했어요</Text>
          <Text style={styles.stateBody}>{errorMessage}</Text>
        </View>
      );
    }
    return (
      <View style={styles.stateView}>
        <Text style={styles.stateTitle}>표시할 단어가 없어요</Text>
        <Text style={styles.stateBody}>필터를 바꾸면 더 많은 단어를 볼 수 있어요.</Text>
      </View>
    );
  }, [errorMessage, isLoading]);

  return (
    <View style={styles.container}>
      <View style={styles.summaryBar}>
        <View style={styles.actionChips}>
          <SummaryChip icon="sliders" onPress={openFilterSheet} />
          <SummaryChip icon="arrow-down" onPress={openSortSheet} />
        </View>

        <View style={styles.summarySpacer} />

        <TouchableOpacity
          style={[styles.batchButton, batchCount === 0 && styles.batchButtonDisabled]}
          onPress={handleBatchAdd}
          disabled={batchCount === 0 || isBatchSaving}
          activeOpacity={0.7}
        >
          {isBatchSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="plus" size={12} color="#FFFFFF" />
              <Text style={styles.batchButtonText}>{batchCount}개 담기</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.listContent, { paddingBottom: bottomPadding + insets.bottom }]}>
        {visibleWords.length === 0 ? listEmpty : renderedWords.map(word => {
          const state = getWordSaveState(word);
          const wordKey = getSongDetailWordKey(word);
          return (
            <SongDetailWordRow
              key={wordKey}
              word={word}
              isSaved={state.isSavedForSong}
              isBusy={busyWordKey === wordKey}
              onToggleSave={onToggleWordSave}
            />
          );
        })}
      </View>

      <AppBottomSheetModal
        ref={sortSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
      >
        <BottomSheetView>
          <SongDetailSortSheet value={sort} onApply={handleSortApply} onClose={closeSortSheet} />
        </BottomSheetView>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        ref={filterSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
      >
        <BottomSheetScrollView>
          <SongDetailFilterSheet
            availablePos={availablePos}
            selectedPos={selectedPos}
            availableJlpt={availableJlpt}
            selectedJlpt={selectedJlpt}
            includeUnknownJlpt={includeUnknownJlpt}
            onTogglePos={togglePos}
            onToggleJlpt={toggleJlpt}
            onToggleUnknownJlpt={toggleUnknownJlpt}
            onReset={resetFilters}
            onApply={applyFilters}
            onClose={closeFilterSheet}
          />
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  summaryBar: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  actionChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryChip: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  summarySpacer: {
    flex: 1,
    minWidth: 0,
  },
  batchButton: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 9999,
    paddingHorizontal: 12,
    backgroundColor: Colors.primary,
  },
  batchButtonDisabled: {
    opacity: 0.4,
  },
  batchButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    backgroundColor: Colors.background,
  },
  stateView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 80,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  stateBody: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  sheetBg: {
    backgroundColor: Colors.background,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
});
