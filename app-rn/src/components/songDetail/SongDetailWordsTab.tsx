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
import AppDialog from '../AppDialog';
import { AppBottomSheetModal, AppBottomSheetModalRef } from '../bottomSheet';
import { Colors } from '../../theme/theme';
import SongDetailWordRow from './SongDetailWordRow';
import SongDetailSortSheet from './SongDetailSortSheet';
import SongDetailFilterSheet from './SongDetailFilterSheet';
import {
  SongDetailWordItem,
  SongDetailWordSaveState,
  SongDetailWordsSort,
  WordsInSongDto,
} from './types';

const DEFAULT_POS = ['NOUN', 'VERB', 'ADJECTIVE', 'NA_ADJECTIVE', 'ADVERB'];
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
  isLoading?: boolean;
  errorMessage?: string | null;
  bottomPadding?: number;
  onWordsChanged?: () => void;
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

function getWordKey(word: SongDetailWordItem): string {
  return `${word.baseForm}:${word.appearanceOrder}`;
}

function getWordSaveKey(word: SongDetailWordItem): string {
  return word.addRequest.japanese || word.japanese;
}

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
  return data?.filterDefaults?.includeUnknownJlpt ?? false;
}

function getInitialSort(data: WordsInSongDto | null): SongDetailWordsSort {
  return data?.filterDefaults?.sortDefault?.toUpperCase() === 'APPEARANCE' ? 'appearance' : 'importance';
}

export default function SongDetailWordsTab({
  data,
  isLoading = false,
  errorMessage = null,
  bottomPadding = 150,
  onWordsChanged,
}: Props) {
  const insets = useSafeAreaInsets();
  const sortSheetRef = useRef<AppBottomSheetModalRef>(null);
  const filterSheetRef = useRef<AppBottomSheetModalRef>(null);
  const [sort, setSort] = useState<SongDetailWordsSort>(() => getInitialSort(data));
  const [selectedPos, setSelectedPos] = useState<Set<string>>(() => getInitialPos(data));
  const [selectedJlpt, setSelectedJlpt] = useState<Set<string>>(() => getInitialJlpt(data));
  const [includeUnknownJlpt, setIncludeUnknownJlpt] = useState(() => getInitialIncludeUnknownJlpt(data));
  const [saveOverrides, setSaveOverrides] = useState<Map<string, SongDetailWordSaveState>>(() => new Map());
  const [busyWordKey, setBusyWordKey] = useState<string | null>(null);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<SongDetailWordItem | null>(null);

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

  const getSaveState = useCallback((word: SongDetailWordItem): SongDetailWordSaveState => {
    const override = saveOverrides.get(getWordSaveKey(word));
    if (override) {
      return {
        isSavedForSong: override.isSavedForSong,
        savedWordId: override.isSavedForSong ? (override.savedWordId ?? word.savedWordId) : null,
      };
    }
    return {
      isSavedForSong: word.isSavedForSong || word.savedWordId != null,
      savedWordId: word.savedWordId,
    };
  }, [saveOverrides]);

  const batchCandidates = useMemo(
    () => visibleWords.filter(word => !getSaveState(word).isSavedForSong),
    [getSaveState, visibleWords],
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
      setSaveOverrides(prev => {
        const next = new Map(prev);
        batchCandidates.forEach(word => {
          next.set(getWordSaveKey(word), { isSavedForSong: true, savedWordId: null });
        });
        return next;
      });
      onWordsChanged?.();
    } finally {
      setIsBatchSaving(false);
    }
  }, [batchCandidates, isBatchSaving, onWordsChanged]);

  const handleToggleSave = useCallback(async (word: SongDetailWordItem) => {
    const wordKey = getWordKey(word);
    const state = getSaveState(word);
    if (state.isSavedForSong) {
      setPendingRemove(word);
      return;
    }

    setBusyWordKey(wordKey);
    try {
      const result = await wordApi.addWord(word.addRequest);
      setSaveOverrides(prev => {
        const next = new Map(prev);
        next.set(getWordSaveKey(word), { isSavedForSong: true, savedWordId: result.id });
        return next;
      });
      onWordsChanged?.();
    } finally {
      setBusyWordKey(null);
    }
  }, [getSaveState, onWordsChanged]);

  const cancelRemove = useCallback(() => {
    setPendingRemove(null);
  }, []);

  const confirmRemove = useCallback(async () => {
    if (pendingRemove == null) return;
    const wordKey = getWordKey(pendingRemove);
    const state = getSaveState(pendingRemove);
    if (state.savedWordId == null) {
      setPendingRemove(null);
      return;
    }

    setBusyWordKey(wordKey);
    try {
      await wordApi.deleteWord(state.savedWordId);
      setSaveOverrides(prev => {
        const next = new Map(prev);
        next.set(getWordSaveKey(pendingRemove), { isSavedForSong: false, savedWordId: null });
        return next;
      });
      onWordsChanged?.();
    } finally {
      setBusyWordKey(null);
      setPendingRemove(null);
    }
  }, [getSaveState, onWordsChanged, pendingRemove]);

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
        {visibleWords.length === 0 ? listEmpty : visibleWords.map(word => {
          const state = getSaveState(word);
          const wordKey = getWordKey(word);
          return (
            <SongDetailWordRow
              key={wordKey}
              word={word}
              isSaved={state.isSavedForSong}
              isBusy={busyWordKey === wordKey}
              onToggleSave={handleToggleSave}
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

      <AppDialog
        visible={pendingRemove !== null}
        title="단어장에서 뺄까요?"
        body={'이 단어의 뜻, 예문, 플래시카드가\n모두 삭제돼요.'}
        buttons={[
          { label: '취소', variant: 'secondary', onPress: cancelRemove },
          { label: '빼기', variant: 'danger', onPress: confirmRemove },
        ]}
      />
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
