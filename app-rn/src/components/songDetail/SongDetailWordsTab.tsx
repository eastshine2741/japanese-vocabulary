import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { wordApi } from '../../api/wordApi';
import AppDialog from '../AppDialog';
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
  label: string;
  onPress: () => void;
}

const SummaryChip = React.memo(function SummaryChip({ icon, label, onPress }: SummaryChipProps) {
  return (
    <TouchableOpacity style={styles.summaryChip} onPress={onPress} activeOpacity={0.7}>
      <Feather name={icon} size={12} color={Colors.textSecondary} />
      <Text style={styles.summaryChipText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
});

function getWordKey(word: SongDetailWordItem): string {
  return `${word.baseForm}:${word.appearanceOrder}`;
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
  const sortSheetRef = useRef<BottomSheet>(null);
  const filterSheetRef = useRef<BottomSheet>(null);
  const [sort, setSort] = useState<SongDetailWordsSort>(() => getInitialSort(data));
  const [selectedPos, setSelectedPos] = useState<Set<string>>(() => getInitialPos(data));
  const [selectedJlpt, setSelectedJlpt] = useState<Set<string>>(() => getInitialJlpt(data));
  const [includeUnknownJlpt, setIncludeUnknownJlpt] = useState(() => getInitialIncludeUnknownJlpt(data));
  const [saveOverrides, setSaveOverrides] = useState<Map<string, SongDetailWordSaveState>>(() => new Map());
  const [busyWordKey, setBusyWordKey] = useState<string | null>(null);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<SongDetailWordItem | null>(null);

  const words = data?.words ?? [];

  useEffect(() => {
    setSort(getInitialSort(data));
    setSelectedPos(getInitialPos(data));
    setSelectedJlpt(getInitialJlpt(data));
    setIncludeUnknownJlpt(getInitialIncludeUnknownJlpt(data));
  }, [data]);

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
    const override = saveOverrides.get(getWordKey(word));
    if (override) return override;
    return {
      isSavedForSong: word.isSavedForSong || word.savedWordId != null,
      savedWordId: word.savedWordId,
    };
  }, [saveOverrides]);

  const filterLabel = useMemo(() => {
    const allAvailablePosSelected = availablePos.length > 0 && availablePos.every(pos => selectedPos.has(pos));
    const selectedAvailablePosCount = availablePos.filter(pos => selectedPos.has(pos)).length;
    const posLabel = allAvailablePosSelected
      ? '품사 전체'
      : `${selectedAvailablePosCount}품사`;
    const jlptLabel = selectedJlpt.size === availableJlpt.length
      ? 'JLPT 전체'
      : Array.from(selectedJlpt).sort((a, b) => JLPT_ORDER.indexOf(a) - JLPT_ORDER.indexOf(b)).join('/') || 'JLPT 0';
    return `${posLabel} · ${jlptLabel}${includeUnknownJlpt ? '+미분류' : ''}`;
  }, [availableJlpt.length, availablePos, includeUnknownJlpt, selectedJlpt, selectedPos]);

  const sortLabel = sort === 'importance' ? '중요도순' : '등장순';
  const batchCandidates = useMemo(
    () => visibleWords.filter(word => !getSaveState(word).isSavedForSong),
    [getSaveState, visibleWords],
  );
  const visibleCount = visibleWords.length;
  const batchCount = batchCandidates.length;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.25} />
    ),
    [],
  );

  const openSortSheet = useCallback(() => {
    sortSheetRef.current?.expand();
  }, []);

  const openFilterSheet = useCallback(() => {
    filterSheetRef.current?.expand();
  }, []);

  const handleSortApply = useCallback((value: SongDetailWordsSort) => {
    setSort(value);
    sortSheetRef.current?.close();
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
    filterSheetRef.current?.close();
  }, []);

  const handleBatchAdd = useCallback(async () => {
    if (batchCandidates.length === 0 || isBatchSaving) return;
    setIsBatchSaving(true);
    try {
      await wordApi.batchAddWords({ words: batchCandidates.map(word => word.addRequest) });
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
        next.set(wordKey, { isSavedForSong: true, savedWordId: result.id });
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
        next.set(wordKey, { isSavedForSong: false, savedWordId: null });
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
        <View style={styles.summaryTextWrap}>
          <Text style={styles.summaryCount}>{visibleCount}개</Text>
          <Text style={styles.summarySub} numberOfLines={1}>
            {sortLabel} · {filterLabel}
          </Text>
        </View>

        <SummaryChip icon="sliders" label="필터" onPress={openFilterSheet} />
        <SummaryChip icon="arrow-down" label={sortLabel} onPress={openSortSheet} />

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

      <BottomSheet
        ref={sortSheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        style={styles.modalSheet}
        handleComponent={null}
      >
        <SongDetailSortSheet value={sort} onApply={handleSortApply} />
      </BottomSheet>

      <BottomSheet
        ref={filterSheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        style={styles.modalSheet}
        handleComponent={null}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}>
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
          />
        </BottomSheetScrollView>
      </BottomSheet>

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
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  summaryTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  summaryCount: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  summarySub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  summaryChip: {
    height: 32,
    maxWidth: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 9999,
    paddingHorizontal: 10,
    backgroundColor: Colors.elevated,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  batchButton: {
    height: 32,
    minWidth: 86,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 9999,
    paddingHorizontal: 12,
    backgroundColor: Colors.primary,
  },
  batchButtonDisabled: {
    opacity: 0.4,
  },
  batchButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  listContent: {
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.background,
  },
  modalSheet: {
    zIndex: 100,
    elevation: 100,
  },
});
