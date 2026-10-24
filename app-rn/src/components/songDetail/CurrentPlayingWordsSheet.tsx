import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, SharedValue, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/theme';
import { Layers } from '../../theme/layers';
import { DarkText } from './SongLyricsDial';
import {
  AppBottomSheet,
  AppBottomSheetBackgroundProps,
  AppBottomSheetRef,
  AppBottomSheetView,
} from '../bottomSheet';
import { useArtBackdrop } from '../rewardCards/artColors';
import { useLyricTranslationStore } from '../../stores/lyricTranslationStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Token } from '../../types/song';
import SongLyricsDial, { SongLyricsDialEntry } from './SongLyricsDial';
import { SongDetailWordItem } from './types';
import { getCurrentLyricLineIndex } from './useCurrentLyricLine';

export const CURRENT_PLAYING_WORDS_PEEK_HEIGHT = 70;

/** 가사가 아래 알약 밑으로 흘러가는 걸 가리는 그라데이션. */
const BOTTOM_FADE_HEIGHT = 144;
/** 커버가 없거나 색을 아직 못 뽑았을 때의 바탕. */
const FALLBACK_BACKDROP: [string, string] = ['#2A2A31', '#141418'];
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
  artworkUrl?: string | null;
  /** 접힘 0 ↔ 펼침 1. 핸들 안 헤더가 바탕 색 전환에 맞춰 글자색을 바꾸는 데 쓴다. */
  animatedIndex?: SharedValue<number>;
  lines: CurrentPlayingLyricLine[];
  words?: CurrentPlayingWord[];
  lineWordIndexes?: Record<string, number[]> | Map<number, number[]>;
  lyricType?: 'SYNCED' | 'PLAIN';
  fallbackLineIndex?: number;
  /** 처음 열릴 때 접힘 0 / 펼침 1. */
  initialIndex?: number;
  bottomInset?: number;
  expandedHeight?: number;
  header?: React.ReactNode;
  headerHeight?: number;
  zIndex?: number;
  busyWordKey: string | null;
  /** 단어를 누르면 그 단어부터 복습한다 — 단어 탭·주요 단어와 같은 동작. */
  onStartWordReview: (word: CurrentPlayingWord) => void;
  /** 포커스 줄의 제보 버튼. 없으면 버튼을 그리지 않는다. */
  onReportLine?: (line: CurrentPlayingLyricLine) => void;
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

const SheetBackdropContext = React.createContext<[string, string]>(FALLBACK_BACKDROP);

/** 접혀 있을 땐 흰 바탕이고, 펼칠수록 커버에서 뽑은 두 색 그라데이션이 떠오른다. 모듈 레벨이어야 다시 마운트되지 않는다. */
function SheetBackground({ style, animatedIndex }: AppBottomSheetBackgroundProps) {
  const colors = React.useContext(SheetBackdropContext);
  const colorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <View pointerEvents="none" style={[style, styles.sheetBackground]}>
      <Animated.View style={[StyleSheet.absoluteFill, colorStyle]}>
        <LinearGradient
          style={StyleSheet.absoluteFill}
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
    </View>
  );
}

interface TogglePillProps {
  label: string;
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconOn: keyof typeof Ionicons.glyphMap;
  isOn: boolean;
  disabled?: boolean;
  onPress: () => void;
}

const TogglePill = React.memo(function TogglePill({
  label,
  accessibilityLabel,
  icon,
  iconOn,
  isOn,
  disabled = false,
  onPress,
}: TogglePillProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: isOn, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={[
        styles.pill,
        isOn ? styles.pillOn : styles.pillOff,
        disabled && styles.pillDisabled,
      ]}
    >
      <Ionicons
        name={isOn ? iconOn : icon}
        size={15}
        color={isOn ? Colors.primary : DarkText.secondary}
      />
      <Text style={[styles.pillText, isOn && styles.pillTextOn]}>
        {`${label} ${isOn ? 'ON' : 'OFF'}`}
      </Text>
    </Pressable>
  );
});

/**
 * MV 바가 시트의 핸들이다. 본문 pan 은 가사 다이얼이 가져가므로, 시트는 이 핸들로만 끈다.
 * 모듈 레벨 컴포넌트여야 한다 — 매 렌더 새 함수를 handleComponent 로 넘기면 핸들이 다시 마운트돼 MV WebView 가 초기화된다.
 */
function SheetHandle() {
  const { header, headerHeight } = React.useContext(SheetHandleContext);
  return <View style={[styles.headerSlot, { height: headerHeight }]}>{header}</View>;
}

const CurrentPlayingWordsSheetComponent = React.forwardRef<AppBottomSheetRef, CurrentPlayingWordsSheetProps>(function CurrentPlayingWordsSheetComponent({
  artworkUrl,
  animatedIndex,
  lines,
  words = [],
  lineWordIndexes,
  lyricType,
  fallbackLineIndex = 0,
  initialIndex = 0,
  bottomInset,
  expandedHeight,
  header,
  headerHeight = 0,
  zIndex = Layers.currentPlayingWordsSheet,
  busyWordKey,
  onStartWordReview,
  onReportLine,
  onSheetChange,
  onSyncedPageChange,
}, ref) {
  const insets = useSafeAreaInsets();
  const backdrop = useArtBackdrop(artworkUrl) ?? FALLBACK_BACKDROP;
  const { height: screenHeight } = useWindowDimensions();
  const inferredLyricType = lyricType ?? (lines.some(line => line.startTimeMs != null) ? 'SYNCED' : 'PLAIN');
  const canAutoSync = inferredLyricType === 'SYNCED';
  const [autoSyncEnabled, setAutoSyncEnabled] = React.useState(canAutoSync);
  const [manualLineIndex, setManualLineIndex] = React.useState(() => Math.max(fallbackLineIndex, 0));
  // 싱크 중 줄을 고르면 seek 이 닿을 때까지 옛 시각이 오므로, 그동안 고른 줄을 붙잡아 포커스 흔들림을 막는다.
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
    // lineWordIndexes 는 이미 줄 안 등장순이다. 다시 정렬하면 곡 전체 등장순으로 덮인다.
    const wordIndexes = getLineWordIndexes(lineWordIndexes, line.index);
    return {
      key: String(line.index),
      line,
      words: wordIndexes.map(wordIndex => words[wordIndex]).filter(Boolean),
    };
  }), [lines, words, lineWordIndexes]);

  // 재생 시각은 100ms 마다 바뀐다. 줄 번호로 좁혀 구독해야 시트 전체가 매 틱 다시 그려지지 않는다.
  const playingLineIndex = usePlayerStore(
    s => getCurrentLyricLineIndex(lines, s.currentMs, fallbackLineIndex),
  );
  const seekArrived = usePlayerStore(
    s => pendingSync != null && s.currentMs !== pendingSync.seekMs,
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

  // 플레이어는 버퍼링이 끝날 때까지(수 초) seek 전 시각을 보낸다. seekMs 가 아닌 시각이 고른 줄 안에서 오면 seek 이 닿은 것이다.
  useEffect(() => {
    if (pendingSync == null) return;
    if (playingLineIndex === pendingSync.index && seekArrived) {
      setPendingSync(null);
    }
  }, [pendingSync, playingLineIndex, seekArrived]);

  useEffect(() => {
    if (pendingSync == null) return undefined;
    const timer = setTimeout(() => setPendingSync(null), SEEK_HOLD_MAX_MS);
    return () => clearTimeout(timer);
  }, [pendingSync]);

  const handleStepLine = useCallback((index: number) => {
    const target = entries[index];
    if (!target) return;
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

  const isSyncOn = canAutoSync && autoSyncEnabled;

  const showTranslation = useLyricTranslationStore(s => s.show);
  const setShowTranslation = useLyricTranslationStore(s => s.setShow);
  const showPronunciation = useSettingsStore(s => s.showKoreanPronunciation);
  const toggleShowPronunciation = useSettingsStore(s => s.toggleShowKoreanPronunciation);
  const handleToggleTranslation = useCallback(
    () => setShowTranslation(!showTranslation),
    [setShowTranslation, showTranslation],
  );

  return (
    <SheetBackdropContext.Provider value={backdrop}>
      <SheetHandleContext.Provider value={handleContextValue}>
        <AppBottomSheet
          ref={ref}
          snapPoints={snapPoints}
          index={initialIndex}
          animatedIndex={animatedIndex}
          bottomInset={sheetBottomInset}
          enablePanDownToClose={false}
          enableDynamicSizing={false}
          enableOverDrag={false}
          // 본문의 세로 드래그는 가사 다이얼이 줄을 넘기는 데 쓴다. 시트는 핸들로만 끈다.
          enableContentPanningGesture={false}
          backgroundComponent={SheetBackground}
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
                onReportLine={onReportLine}
              />
            </View>

            <LinearGradient
              pointerEvents="none"
              style={styles.bottomFade}
              colors={['#00000000', '#00000059', '#0000008C']}
              locations={[0, 0.5, 1]}
            />

            <View pointerEvents="box-none" style={styles.actionPills}>
              <TogglePill
                label="싱크"
                accessibilityLabel="가사 자동 넘김"
                icon="locate-outline"
                iconOn="locate"
                isOn={isSyncOn}
                disabled={!canAutoSync}
                onPress={handleToggleAutoSync}
              />
              <TogglePill
                label="번역"
                accessibilityLabel="한국어 번역 표시"
                icon="language-outline"
                iconOn="language"
                isOn={showTranslation}
                onPress={handleToggleTranslation}
              />
              <TogglePill
                label="발음"
                accessibilityLabel="한국어 발음 표시"
                icon="chatbubble-ellipses-outline"
                iconOn="chatbubble-ellipses"
                isOn={showPronunciation}
                onPress={toggleShowPronunciation}
              />
            </View>
          </AppBottomSheetView>
        </AppBottomSheet>
      </SheetHandleContext.Provider>
    </SheetBackdropContext.Provider>
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
    overflow: 'hidden',
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetContent: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerSlot: {
    width: '100%',
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  pillOff: {
    borderColor: '#FFFFFF33',
    backgroundColor: '#FFFFFF14',
  },
  pillDisabled: {
    opacity: 0.48,
  },
  pillText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
    color: DarkText.secondary,
  },
  pillTextOn: {
    color: Colors.primary,
  },
});
