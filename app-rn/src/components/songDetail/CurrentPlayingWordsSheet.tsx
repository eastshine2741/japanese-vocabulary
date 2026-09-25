import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/theme';
import { Layers } from '../../theme/layers';
import { AppBottomSheet, AppBottomSheetRef, AppBottomSheetView } from '../bottomSheet';
import { Token } from '../../types/song';
import SongLyricsDial, { SongLyricsDialEntry } from './SongLyricsDial';
import { SongDetailWordItem } from './types';
import { getCurrentLyricLineIndex } from './useCurrentLyricLine';

export const CURRENT_PLAYING_WORDS_PEEK_HEIGHT = 70;

/** 가사가 아래 알약 밑으로 흘러가는 걸 가리는 흰 그라데이션. */
const BOTTOM_FADE_HEIGHT = 144;
/** 싱크 중 고른 줄을 붙잡아 두는 최대 시간. seek 이 끝내 닿지 않아도 이 뒤엔 재생 위치를 따른다. */
const SEEK_HOLD_MAX_MS = 5000;

export interface CurrentPlayingLyricLine {
  index: number;
  originalText: string;
  startTimeMs: number | null;
  koreanLyrics: string | null;
  /** 줄 발음은 토큰에서 조립한다. 토큰마다 그 줄에서 불리는 발음이 들어 있다. */
  tokens?: Token[];
}

export type CurrentPlayingWord = SongDetailWordItem & {
  id?: number | string;
  baseFormReading?: string | null;
  senses?: { meaning: string }[];
};

export interface CurrentPlayingWordsSheetProps {
  lines: CurrentPlayingLyricLine[];
  words?: CurrentPlayingWord[];
  lineWordIndexes?: Record<string, number[]> | Map<number, number[]>;
  lyricType?: 'SYNCED' | 'PLAIN';
  currentTimeMs: number;
  fallbackLineIndex?: number;
  bottomInset?: number;
  expandedHeight?: number;
  header?: React.ReactNode;
  headerHeight?: number;
  zIndex?: number;
  busyWordKey: string | null;
  /** 단어를 누르면 그 단어부터 복습한다 — 단어 탭·주요 단어와 같은 동작. */
  onStartWordReview: (word: CurrentPlayingWord) => void;
  onSheetChange?: (index: number) => void;
  onSyncedPageChange?: (line: CurrentPlayingLyricLine) => void;
}

function getLineWordIndexes(
  lineWordIndexes: Record<string, number[]> | Map<number, number[]> | undefined,
  lineIndex: number,
): number[] {
  if (!lineWordIndexes) return [];
  if (lineWordIndexes instanceof Map) return lineWordIndexes.get(lineIndex) ?? [];
  return lineWordIndexes[String(lineIndex)] ?? [];
}

interface SheetHandleContextValue {
  header: React.ReactNode;
  headerHeight: number;
}

const SheetHandleContext = React.createContext<SheetHandleContextValue>({
  header: null,
  headerHeight: 0,
});

/**
 * MV 바가 시트의 핸들이다. 본문 pan 은 가사 다이얼이 가져가므로, 시트는 이 핸들로만 끈다.
 *
 * 모듈 레벨 컴포넌트여야 한다 — handleComponent 로 매 렌더 새 함수를 넘기면 React 가
 * 다른 타입으로 보고 핸들을 새로 마운트해서, 안에 든 MV WebView 가 계속 초기화된다.
 * 바뀌는 값은 context 로 넘겨 리렌더만 시킨다.
 */
function SheetHandle() {
  const { header, headerHeight } = React.useContext(SheetHandleContext);
  return <View style={[styles.headerSlot, { height: headerHeight }]}>{header}</View>;
}

const CurrentPlayingWordsSheetComponent = React.forwardRef<AppBottomSheetRef, CurrentPlayingWordsSheetProps>(function CurrentPlayingWordsSheetComponent({
  lines,
  words = [],
  lineWordIndexes,
  lyricType,
  currentTimeMs,
  fallbackLineIndex = 0,
  bottomInset,
  expandedHeight,
  header,
  headerHeight = 0,
  zIndex = Layers.currentPlayingWordsSheet,
  busyWordKey,
  onStartWordReview,
  onSheetChange,
  onSyncedPageChange,
}, ref) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const inferredLyricType = lyricType ?? (lines.some(line => line.startTimeMs != null) ? 'SYNCED' : 'PLAIN');
  const canAutoSync = inferredLyricType === 'SYNCED';
  const [autoSyncEnabled, setAutoSyncEnabled] = React.useState(canAutoSync);
  // 싱크를 끄면 재생과 무관하게 사용자가 고른 줄을 붙잡아 둔다.
  const [manualLineIndex, setManualLineIndex] = React.useState(() => Math.max(fallbackLineIndex, 0));
  // 싱크가 켜진 채로 줄을 고르면 seek 이 플레이어에 닿을 때까지 몇 틱은 옛 시각이 온다.
  // 그동안 고른 줄을 붙잡아 둬야 포커스가 왔다 갔다 하지 않는다.
  const [pendingSync, setPendingSync] = React.useState<{ index: number; seekMs: number } | null>(null);

  const sheetBottomInset = bottomInset ?? insets.bottom;
  const collapsedHeight = header ? headerHeight : CURRENT_PLAYING_WORDS_PEEK_HEIGHT;
  const snapPoints = useMemo<(string | number)[]>(
    () => [
      collapsedHeight,
      expandedHeight ?? Math.max(320, screenHeight - sheetBottomInset - insets.top),
    ],
    [collapsedHeight, expandedHeight, insets.top, screenHeight, sheetBottomInset],
  );

  const entries = useMemo<SongLyricsDialEntry[]>(() => lines.map((line) => {
    // lineWordIndexes 는 서버가 그 줄에 나온 순서로 내려준다. 여기서 다시 정렬하면
    // 줄 안 어순이 곡 전체 등장순으로 덮인다 — 후렴에서 먼저 나온 단어가 앞으로 끌려온다.
    const wordIndexes = getLineWordIndexes(lineWordIndexes, line.index);
    return {
      key: String(line.index),
      line,
      words: wordIndexes.map(wordIndex => words[wordIndex]).filter(Boolean),
    };
  }), [lines, words, lineWordIndexes]);

  const playingLineIndex = useMemo(
    () => getCurrentLyricLineIndex(lines, currentTimeMs, fallbackLineIndex),
    [lines, currentTimeMs, fallbackLineIndex],
  );

  const clampIndex = useCallback(
    (index: number) => Math.min(Math.max(index, 0), Math.max(entries.length - 1, 0)),
    [entries.length],
  );

  const focusedIndex = clampIndex(
    autoSyncEnabled ? (pendingSync?.index ?? playingLineIndex) : manualLineIndex,
  );

  useEffect(() => {
    setAutoSyncEnabled(canAutoSync);
  }, [canAutoSync]);

  useEffect(() => {
    setManualLineIndex(prev => Math.min(prev, Math.max(entries.length - 1, 0)));
  }, [entries.length]);

  // seek 하자마자 currentMs 를 고른 줄 시각으로 먼저 바꿔 두지만, 플레이어는 버퍼링이
  // 끝날 때까지(수 초) seek 전 시각을 계속 보낸다. 플레이어가 고른 줄 안의 시각을 직접
  // 보고해야 seek 이 닿은 것으로 본다 — 먼저 바꿔 둔 값(seekMs) 그대로면 아직 아니다.
  useEffect(() => {
    if (pendingSync == null) return;
    if (playingLineIndex === pendingSync.index && currentTimeMs !== pendingSync.seekMs) {
      setPendingSync(null);
    }
  }, [currentTimeMs, pendingSync, playingLineIndex]);

  useEffect(() => {
    if (pendingSync == null) return undefined;
    const timer = setTimeout(() => setPendingSync(null), SEEK_HOLD_MAX_MS);
    return () => clearTimeout(timer);
  }, [pendingSync]);

  const handleStepLine = useCallback((index: number) => {
    const target = entries[index];
    if (!target) return;
    // 싱크가 켜져 있으면 줄을 고르는 건 곧 그 줄로 재생을 옮기는 것이다.
    if (autoSyncEnabled) {
      if (target.line.startTimeMs == null) return;
      setPendingSync({ index, seekMs: target.line.startTimeMs });
      onSyncedPageChange?.(target.line);
      return;
    }
    setManualLineIndex(index);
  }, [autoSyncEnabled, entries, onSyncedPageChange]);

  const handleToggleAutoSync = useCallback(() => {
    if (!canAutoSync) return;
    setPendingSync(null);
    if (autoSyncEnabled) setManualLineIndex(focusedIndex);
    setAutoSyncEnabled(!autoSyncEnabled);
  }, [autoSyncEnabled, canAutoSync, focusedIndex]);

  const handleContextValue = useMemo<SheetHandleContextValue>(
    () => ({ header, headerHeight }),
    [header, headerHeight],
  );

  const syncLabel = canAutoSync && autoSyncEnabled ? '싱크 ON' : '싱크 OFF';
  const isSyncOn = canAutoSync && autoSyncEnabled;

  return (
    <SheetHandleContext.Provider value={handleContextValue}>
      <AppBottomSheet
        ref={ref}
        snapPoints={snapPoints}
        index={0}
        bottomInset={sheetBottomInset}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        enableOverDrag={false}
        // 본문의 세로 드래그는 가사 다이얼이 줄을 넘기는 데 쓴다. 시트는 핸들로만 끈다.
        enableContentPanningGesture={false}
        backgroundStyle={styles.sheetBackground}
        handleComponent={header ? SheetHandle : null}
        containerStyle={[styles.sheetContainer, { zIndex, elevation: zIndex }]}
        style={[styles.sheet, { zIndex, elevation: zIndex }]}
        onChange={onSheetChange}
      >
        <AppBottomSheetView fill style={styles.sheetContent}>
          <View style={styles.lyricsArea}>
            <SongLyricsDial
              entries={entries}
              focusedIndex={focusedIndex}
              busyWordKey={busyWordKey}
              onStepLine={handleStepLine}
              onWordPress={onStartWordReview}
            />
          </View>

          <LinearGradient
            pointerEvents="none"
            style={styles.bottomFade}
            colors={['#FFFFFF00', '#FFFFFFD9', '#FFFFFF']}
            locations={[0, 0.5, 1]}
          />

          <View pointerEvents="box-none" style={styles.actionPills}>
            <Pressable
              accessibilityLabel="가사 자동 넘김"
              accessibilityRole="switch"
              accessibilityState={{ checked: isSyncOn, disabled: !canAutoSync }}
              disabled={!canAutoSync}
              hitSlop={8}
              onPress={handleToggleAutoSync}
              style={[
                styles.syncPill,
                isSyncOn ? styles.syncPillOn : styles.syncPillOff,
                !canAutoSync && styles.syncPillDisabled,
              ]}
            >
              <Ionicons
                name={isSyncOn ? 'locate' : 'locate-outline'}
                size={15}
                color={isSyncOn ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.syncPillText, isSyncOn && styles.syncPillTextOn]}>
                {syncLabel}
              </Text>
            </Pressable>
          </View>
        </AppBottomSheetView>
      </AppBottomSheet>
    </SheetHandleContext.Provider>
  );
});

export const CurrentPlayingWordsSheet = React.memo(CurrentPlayingWordsSheetComponent);

const styles = StyleSheet.create({
  sheetContainer: {
    zIndex: Layers.currentPlayingWordsSheet,
    elevation: Layers.currentPlayingWordsSheet,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  sheetBackground: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetContent: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.background,
  },
  headerSlot: {
    width: '100%',
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.background,
  },
  lyricsArea: {
    flex: 1,
    paddingTop: 34,
    overflow: 'hidden',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_FADE_HEIGHT,
  },
  actionPills: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 9,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
  },
  syncPillOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  syncPillOff: {
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  syncPillDisabled: {
    opacity: 0.48,
  },
  syncPillText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  syncPillTextOn: {
    color: Colors.primary,
  },
});
