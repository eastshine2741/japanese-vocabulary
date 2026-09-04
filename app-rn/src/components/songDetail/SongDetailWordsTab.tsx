import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { wordApi } from '../../api/wordApi';
import {
  AppBottomSheetModal,
  AppBottomSheetModalRef,
  AppBottomSheetView,
  AppSheetHandoffScrollView,
} from '../bottomSheet';
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

interface UseSongDetailWordsTabParams {
  data: WordsInSongDto | null;
  isActive?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  onWordsChanged?: () => void;
  getWordSaveState: (word: SongDetailWordItem) => SongDetailWordSaveState;
  onWordsBatchAdded: (words: SongDetailWordItem[]) => void | Promise<void>;
}

interface Props {
  state: SongDetailWordsTabState;
  bottomPadding?: number;
  getWordSaveState: (word: SongDetailWordItem) => SongDetailWordSaveState;
  busyWordKey: string | null;
  onToggleWordSave: (word: SongDetailWordItem) => void;
}

interface SummaryChipProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
}

const SummaryChip = React.memo(function SummaryChip({ icon, onPress, accessibilityLabel }: SummaryChipProps) {
  return (
    <TouchableOpacity
      style={styles.summaryChip}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={16} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
});

interface SortSummaryChipProps {
  onPress: () => void;
}

const SortSummaryChip = React.memo(function SortSummaryChip({ onPress }: SortSummaryChipProps) {
  return (
    <TouchableOpacity
      style={styles.summaryChip}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="정렬"
    >
      <Ionicons name="swap-vertical" size={16} color={Colors.textSecondary} />
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
  return data?.filterDefaults?.sortDefault?.toUpperCase() === 'IMPORTANCE' ? 'importance' : 'appearance';
}

export function useSongDetailWordsTab({
  data,
  isActive = true,
  isLoading = false,
  errorMessage = null,
  onWordsChanged,
  getWordSaveState,
  onWordsBatchAdded,
}: UseSongDetailWordsTabParams): SongDetailWordsTabState {
  const sortSheetRef = useRef<AppBottomSheetModalRef>(null);
  const filterSheetRef = useRef<AppBottomSheetModalRef>(null);
  const [sort, setSort] = useState<SongDetailWordsSort>(() => getInitialSort(data));
  const [selectedPos, setSelectedPos] = useState<Set<string>>(() => getInitialPos(data));
  const [selectedJlpt, setSelectedJlpt] = useState<Set<string>>(() => getInitialJlpt(data));
  const [includeUnknownJlpt, setIncludeUnknownJlpt] = useState(() => getInitialIncludeUnknownJlpt(data));
  const [draftSelectedPos, setDraftSelectedPos] = useState<Set<string>>(() => getInitialPos(data));
  const [draftSelectedJlpt, setDraftSelectedJlpt] = useState<Set<string>>(() => getInitialJlpt(data));
  const [draftIncludeUnknownJlpt, setDraftIncludeUnknownJlpt] = useState(() => getInitialIncludeUnknownJlpt(data));
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
    setDraftSelectedPos(getInitialPos(data));
    setDraftSelectedJlpt(getInitialJlpt(data));
    setDraftIncludeUnknownJlpt(getInitialIncludeUnknownJlpt(data));
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

  // 배열 identity 가 아니라 목록에 담긴 단어가 바뀔 때만 렌더 개수를 처음으로 되돌린다.
  // 단어를 담으면 곡 단어 목록을 다시 받아오므로 visibleWords 는 내용이 같아도 매번 새 배열이다.
  // 그때 렌더 개수를 18개로 줄이면 목록 높이가 순간 줄어들어, 화면 전체를 감싼 ScrollView 의
  // 스크롤 위치가 위로 튄다.
  const visibleWordsKey = useMemo(
    () => visibleWords.map(getSongDetailWordKey).join('|'),
    [visibleWords],
  );

  useEffect(() => {
    setRenderLimit(Math.min(INITIAL_WORD_RENDER_COUNT, visibleWords.length));
  }, [visibleWordsKey]);

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
  }, [isActive, visibleWordsKey]);

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
    setDraftSelectedPos(new Set(selectedPos));
    setDraftSelectedJlpt(new Set(selectedJlpt));
    setDraftIncludeUnknownJlpt(includeUnknownJlpt);
    filterSheetRef.current?.present();
  }, [includeUnknownJlpt, selectedJlpt, selectedPos]);

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
    setDraftSelectedPos(prev => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos); else next.add(pos);
      return next;
    });
  }, []);

  const toggleJlpt = useCallback((jlpt: string) => {
    setDraftSelectedJlpt(prev => {
      const next = new Set(prev);
      if (next.has(jlpt)) next.delete(jlpt); else next.add(jlpt);
      return next;
    });
  }, []);

  const toggleUnknownJlpt = useCallback(() => {
    setDraftIncludeUnknownJlpt(prev => !prev);
  }, []);

  const resetFilters = useCallback(() => {
    setDraftSelectedPos(getInitialPos(data));
    setDraftSelectedJlpt(getInitialJlpt(data));
    setDraftIncludeUnknownJlpt(getInitialIncludeUnknownJlpt(data));
  }, [data]);

  const applyFilters = useCallback(() => {
    setSelectedPos(new Set(draftSelectedPos));
    setSelectedJlpt(new Set(draftSelectedJlpt));
    setIncludeUnknownJlpt(draftIncludeUnknownJlpt);
    filterSheetRef.current?.dismiss();
  }, [draftIncludeUnknownJlpt, draftSelectedJlpt, draftSelectedPos]);

  const handleBatchAdd = useCallback(async () => {
    if (batchCandidates.length === 0 || isBatchSaving) return;
    setIsBatchSaving(true);
    try {
      await wordApi.batchAddWords({ words: batchCandidates.map(word => word.addRequest) });
      await onWordsBatchAdded(batchCandidates);
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

  return {
    sortSheetRef,
    filterSheetRef,
    availablePos,
    selectedPos,
    draftSelectedPos,
    availableJlpt,
    selectedJlpt,
    draftSelectedJlpt,
    includeUnknownJlpt,
    draftIncludeUnknownJlpt,
    renderedWords,
    visibleWords,
    batchCount,
    isBatchSaving,
    listEmpty,
    openFilterSheet,
    openSortSheet,
    closeFilterSheet,
    closeSortSheet,
    handleSortApply,
    togglePos,
    toggleJlpt,
    toggleUnknownJlpt,
    resetFilters,
    applyFilters,
    handleBatchAdd,
    sort,
  };
}

export interface SongDetailWordsTabState {
  sortSheetRef: React.RefObject<AppBottomSheetModalRef | null>;
  filterSheetRef: React.RefObject<AppBottomSheetModalRef | null>;
  availablePos: string[];
  selectedPos: Set<string>;
  draftSelectedPos: Set<string>;
  availableJlpt: string[];
  selectedJlpt: Set<string>;
  draftSelectedJlpt: Set<string>;
  includeUnknownJlpt: boolean;
  draftIncludeUnknownJlpt: boolean;
  renderedWords: SongDetailWordItem[];
  visibleWords: SongDetailWordItem[];
  batchCount: number;
  isBatchSaving: boolean;
  listEmpty: React.ReactNode;
  openFilterSheet: () => void;
  openSortSheet: () => void;
  closeFilterSheet: () => void;
  closeSortSheet: () => void;
  handleSortApply: (value: SongDetailWordsSort) => void;
  togglePos: (pos: string) => void;
  toggleJlpt: (jlpt: string) => void;
  toggleUnknownJlpt: () => void;
  resetFilters: () => void;
  applyFilters: () => void;
  handleBatchAdd: () => void;
  sort: SongDetailWordsSort;
}

export const SongDetailWordsActionBar = React.memo(function SongDetailWordsActionBar({
  state,
}: {
  state: SongDetailWordsTabState;
}) {
  return (
    <View style={styles.summaryBar}>
      <View style={styles.actionChips}>
        <SummaryChip icon="options" onPress={state.openFilterSheet} accessibilityLabel="필터" />
        <SortSummaryChip onPress={state.openSortSheet} />
      </View>

      <View style={styles.summarySpacer} />

      <Text style={styles.wordCountText}>총 {state.visibleWords.length}개</Text>
    </View>
  );
});

export default function SongDetailWordsTab({
  state,
  bottomPadding = 150,
  getWordSaveState,
  busyWordKey,
  onToggleWordSave,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <SongDetailWordsActionBar state={state} />

      <View style={[styles.listContent, { paddingBottom: bottomPadding + insets.bottom }]}>
        {state.visibleWords.length === 0 ? state.listEmpty : state.renderedWords.map(word => {
          const saveState = getWordSaveState(word);
          const wordKey = getSongDetailWordKey(word);
          return (
            <SongDetailWordRow
              key={wordKey}
              word={word}
              isSaved={saveState.isSavedForSong}
              isBusy={busyWordKey === wordKey}
              onToggleSave={onToggleWordSave}
            />
          );
        })}
      </View>

      <AppBottomSheetModal
        ref={state.sortSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
      >
        <AppBottomSheetView>
          <SongDetailSortSheet value={state.sort} onApply={state.handleSortApply} onClose={state.closeSortSheet} />
        </AppBottomSheetView>
      </AppBottomSheetModal>

      <AppBottomSheetModal
        ref={state.filterSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
      >
        <AppSheetHandoffScrollView>
          <SongDetailFilterSheet
            availablePos={state.availablePos}
            selectedPos={state.draftSelectedPos}
            availableJlpt={state.availableJlpt}
            selectedJlpt={state.draftSelectedJlpt}
            includeUnknownJlpt={state.draftIncludeUnknownJlpt}
            onTogglePos={state.togglePos}
            onToggleJlpt={state.toggleJlpt}
            onToggleUnknownJlpt={state.toggleUnknownJlpt}
            onReset={state.resetFilters}
            onApply={state.applyFilters}
            onClose={state.closeFilterSheet}
          />
        </AppSheetHandoffScrollView>
      </AppBottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  wordCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
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
