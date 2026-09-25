import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  SharedValue,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../theme/theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { convertLineReading } from '../../utils/readingConverter';
import { getSongDetailWordKey } from './songDetailWordSave';
import {
  DEFAULT_LINE_HEIGHT,
  TokenCell,
  buildSlotLayouts,
  buildTokenCells,
  stepTargetIndex,
} from './songLyricsDial';
import type { CurrentPlayingLyricLine, CurrentPlayingWord } from './CurrentPlayingWordsSheet';

/** 포커스 줄의 중심이 다이얼 높이의 어디에 오는지 — 위로 한 줄쯤, 아래로 다음 줄들. */
const FOCUS_CENTER_RATIO = 0.38;
const TRANSITION_DURATION = 280;
const MODE_DURATION = 200;
/** 드래그 중 후보 줄로 띠가 미끄러지는 시간. */
const HIGHLIGHT_SLIDE_MS = 150;
const RENDER_RADIUS = 6;
/** 드래그하는 동안 가사 더미가 뒤로 물러나는 정도. */
const DYNAMIC_SCALE = 0.92;
const DYNAMIC_OPACITY = 0.85;
/** 앵커가 풀린 동안 띠는 옅어져 후보만 약하게 가리킨다. */
const DYNAMIC_HIGHLIGHT_OPACITY = 0.5;
/** 포커스에서 멀어질수록 흐려진다. 마지막 값이 그 너머 전부. */
const DISTANCE_OPACITY = [1, 0.44, 0.3, 0.23, 0.18, 0.15, 0.13];

export interface SongLyricsDialEntry {
  key: string;
  line: CurrentPlayingLyricLine;
  words: CurrentPlayingWord[];
}

interface FocusedLineProps {
  line: CurrentPlayingLyricLine;
  words: CurrentPlayingWord[];
  busyWordKey: string | null;
  onWordPress: (word: CurrentPlayingWord) => void;
}

const FocusedLine = React.memo(function FocusedLine({
  line,
  words,
  busyWordKey,
  onWordPress,
}: FocusedLineProps) {
  const showFurigana = useSettingsStore(s => s.showFurigana);
  const showKoreanPronunciation = useSettingsStore(s => s.showKoreanPronunciation);
  const cells = useMemo(() => buildTokenCells(line, words), [line, words]);
  // 토큰에서 조립한다 — 단어 사이는 띄고, 받침은 토큰 경계를 넘고, 장음은 넘지 않는다.
  const koreanPronunciation = useMemo(
    () => convertLineReading(line.originalText, line.tokens ?? [], 'KOREAN'),
    [line.originalText, line.tokens],
  );
  const hasFurigana = showFurigana && cells.some(cell => cell.furigana);
  const hasMeaning = cells.some(cell => cell.meaning);

  return (
    <View style={styles.focusBand}>
      {cells.length > 0 ? (
        <View style={styles.tokenRow}>
          {cells.map(cell => (
            <TokenCellView
              key={cell.key}
              cell={cell}
              showFurigana={hasFurigana}
              showMeaning={hasMeaning}
              isBusy={cell.word != null && busyWordKey === getSongDetailWordKey(cell.word)}
              onPress={onWordPress}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.focusPlainText}>{line.originalText}</Text>
      )}

      {(showKoreanPronunciation && koreanPronunciation) || line.koreanLyrics ? (
        <View style={styles.lineMeaning}>
          {showKoreanPronunciation && koreanPronunciation ? (
            <Text style={styles.lineReadingText}>{koreanPronunciation}</Text>
          ) : null}
          {line.koreanLyrics ? (
            <Text style={styles.lineKoreanText}>{line.koreanLyrics}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

interface TokenCellViewProps {
  cell: TokenCell;
  showFurigana: boolean;
  showMeaning: boolean;
  isBusy: boolean;
  onPress: (word: CurrentPlayingWord) => void;
}

const TokenCellView = React.memo(function TokenCellView({
  cell,
  showFurigana,
  showMeaning,
  isBusy,
  onPress,
}: TokenCellViewProps) {
  const handlePress = useCallback(() => {
    if (cell.word) onPress(cell.word);
  }, [cell.word, onPress]);

  const body = (
    <View style={styles.tokenCell}>
      {showFurigana ? (
        <Text style={styles.furiganaText} numberOfLines={1}>{cell.furigana ?? ' '}</Text>
      ) : null}
      <Text style={cell.barColor ? styles.tokenText : styles.tokenTextMuted}>{cell.text}</Text>
      <View style={[styles.tokenBar, cell.barColor ? { backgroundColor: cell.barColor } : null]} />
      {showMeaning ? (
        <Text style={cell.barColor ? styles.tokenMeaningText : styles.tokenMeaningTextMuted}>
          {cell.meaning ?? ' '}
        </Text>
      ) : null}
    </View>
  );

  if (!cell.word) return body;

  return (
    <Pressable onPress={handlePress} disabled={isBusy} style={isBusy && styles.tokenCellBusy}>
      {body}
    </Pressable>
  );
});

interface SlotProps {
  entry: SongLyricsDialEntry;
  isFocused: boolean;
  slotTop: number;
  baseOpacity: number;
  busyWordKey: string | null;
  dynamicProgress: SharedValue<number>;
  onMeasured: (height: number) => void;
  onWordPress: (word: CurrentPlayingWord) => void;
}

const Slot = React.memo(function Slot({
  entry,
  isFocused,
  slotTop,
  baseOpacity,
  busyWordKey,
  dynamicProgress,
  onMeasured,
  onWordPress,
}: SlotProps) {
  // 슬롯마다 자기 위쪽을 축으로 줄어든다 — 더미 전체를 한 점으로 모으면 먼 줄이 눈에
  // 띄게 밀린다. 흐리기는 거리에 따른 기본값과 드래그 중 물러남을 곱한다.
  const animStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(dynamicProgress.value, [0, 1], [1, DYNAMIC_SCALE], Extrapolation.CLAMP),
    }],
    opacity: baseOpacity
      * interpolate(dynamicProgress.value, [0, 1], [1, DYNAMIC_OPACITY], Extrapolation.CLAMP),
  }));

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    onMeasured(event.nativeEvent.layout.height);
  }, [onMeasured]);

  return (
    <Animated.View
      style={[styles.slot, { top: slotTop, transformOrigin: 'top' }, animStyle]}
      onLayout={handleLayout}
      pointerEvents={isFocused ? 'auto' : 'none'}
    >
      {isFocused ? (
        <FocusedLine
          line={entry.line}
          words={entry.words}
          busyWordKey={busyWordKey}
          onWordPress={onWordPress}
        />
      ) : (
        <Text style={styles.restLineText}>{entry.line.originalText}</Text>
      )}
    </Animated.View>
  );
});

export interface SongLyricsDialProps {
  entries: SongLyricsDialEntry[];
  /** 지금 펼쳐 보여 줄 줄. 싱크가 켜져 있으면 재생 위치가, 꺼져 있으면 사용자가 정한다. */
  focusedIndex: number;
  busyWordKey: string | null;
  onStepLine: (index: number) => void;
  onWordPress: (word: CurrentPlayingWord) => void;
}

function SongLyricsDial({
  entries,
  focusedIndex,
  busyWordKey,
  onStepLine,
  onWordPress,
}: SongLyricsDialProps) {
  const lineCount = entries.length;
  const safeIndex = Math.max(0, Math.min(lineCount - 1, focusedIndex));

  const [dialHeight, setDialHeight] = useState(0);
  // 줄마다 실제로 그려진 높이. 포커스 띠의 크기이자, 접힌 줄이 서로 겹치지 않게 하는 기준.
  const [lineHeights, setLineHeights] = useState<Record<number, number>>({});
  // 정지↔드래그 모드 전환의 방아쇠. 애니메이션 자체는 dynamicProgress 가 끌고 간다.
  const [isDragging, setIsDragging] = useState(false);
  // 드래그가 줄 경계를 넘었을 때 띠가 가리키는 후보. null 이면 아직 포커스 줄 위에 있다.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const slotLayouts = useMemo(
    () => buildSlotLayouts(lineCount, lineHeights),
    [lineHeights, lineCount],
  );

  const focusCenterY = dialHeight * FOCUS_CENTER_RATIO;
  const safeSlotTop = slotLayouts[safeIndex]?.top ?? safeIndex * DEFAULT_LINE_HEIGHT;
  const safeSlotHeight = slotLayouts[safeIndex]?.height ?? DEFAULT_LINE_HEIGHT;

  // 띠가 달라붙는 줄 — 가만히 있을 땐 포커스 줄, 경계를 넘은 드래그 중엔 후보 줄.
  const candidateIndex = previewIndex ?? safeIndex;
  const candidateSlotTop = slotLayouts[candidateIndex]?.top ?? candidateIndex * DEFAULT_LINE_HEIGHT;
  const candidateSlotHeight = slotLayouts[candidateIndex]?.height ?? DEFAULT_LINE_HEIGHT;

  const stackY = useSharedValue(0);
  const dragOffset = useSharedValue(0);
  // 드래그를 시작한 줄. 싱크 중엔 드래그하는 동안에도 포커스가 넘어가므로 그 기준을 붙잡아 둔다.
  const dragStartIndex = useSharedValue(safeIndex);
  // 지금 드래그가 가리키는 줄 — worklet 안에서 runOnJS 중복 호출을 걸러낸다.
  const lastTarget = useSharedValue(safeIndex);
  const dynamicProgress = useSharedValue(0);
  const highlightTop = useSharedValue(candidateSlotTop);
  const highlightHeight = useSharedValue(candidateSlotHeight);

  const updatePreview = useCallback((index: number | null) => {
    setPreviewIndex(prev => (prev === index ? prev : index));
  }, []);

  const commitLine = useCallback((index: number) => {
    onStepLine(index);
  }, [onStepLine]);

  const handleDialLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setDialHeight(prev => (prev === height ? prev : height));
  }, []);

  const measuredCallbacks = useRef<Record<number, (height: number) => void>>({});
  const getOnMeasured = useCallback((index: number) => {
    if (!measuredCallbacks.current[index]) {
      measuredCallbacks.current[index] = (height: number) => {
        setLineHeights(prev => (prev[index] === height ? prev : { ...prev, [index]: height }));
      };
    }
    return measuredCallbacks.current[index];
  }, []);

  // 줄 수가 달라졌으면 이전 가사의 높이를 그대로 쓰면 안 된다. 같은 가사에 단어만
  // 다시 내려온 경우는 줄마다 onLayout 이 알아서 고쳐 주므로 지우지 않는다 — 지우면
  // 단어 하나 담을 때마다 다이얼이 다시 자리를 잡느라 흔들린다.
  useEffect(() => {
    setLineHeights({});
  }, [lineCount]);

  useEffect(() => {
    dynamicProgress.value = withTiming(isDragging ? 1 : 0, {
      duration: MODE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [dynamicProgress, isDragging]);

  // 포커스 줄의 중심이 focusCenterY 에 오도록 더미를 민다. 다이얼 높이를 재기 전에는
  // 목표를 모르니, 첫 자리잡기만 애니메이션 없이 바로 앉힌다.
  const hasPositionedRef = useRef(false);
  useEffect(() => {
    if (dialHeight === 0) return;
    const target = focusCenterY - safeSlotTop - safeSlotHeight / 2;
    if (!hasPositionedRef.current) {
      hasPositionedRef.current = true;
      stackY.value = target;
      return;
    }
    stackY.value = withTiming(target, {
      duration: TRANSITION_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [dialHeight, focusCenterY, safeSlotHeight, safeSlotTop, stackY]);

  useEffect(() => {
    const options = { duration: HIGHLIGHT_SLIDE_MS, easing: Easing.out(Easing.cubic) };
    highlightTop.value = withTiming(candidateSlotTop, options);
    highlightHeight.value = withTiming(candidateSlotHeight, options);
  }, [candidateSlotHeight, candidateSlotTop, highlightHeight, highlightTop]);

  const panGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetY([-12, 12])
      .failOffsetX([-20, 20])
      .onStart(() => {
        'worklet';
        dragStartIndex.value = safeIndex;
        lastTarget.value = safeIndex;
        runOnJS(setIsDragging)(true);
      })
      .onChange((event) => {
        'worklet';
        dragOffset.value = event.translationY;
        const startIndex = dragStartIndex.value;
        const target = stepTargetIndex(startIndex, event.translationY, lineCount);
        if (target !== lastTarget.value) {
          lastTarget.value = target;
          runOnJS(updatePreview)(target === startIndex ? null : target);
        }
      })
      .onEnd((event) => {
        'worklet';
        const startIndex = dragStartIndex.value;
        const target = stepTargetIndex(startIndex, event.translationY, lineCount);
        lastTarget.value = startIndex;
        runOnJS(updatePreview)(null);
        if (target !== startIndex) {
          // 드래그 값을 stackY 에 흡수시켜, 손을 뗀 자리에서 이어서 움직이게 한다.
          // 안 그러면 드래그는 0 으로 돌아가고 stackY 는 따로 새 줄로 가서 다이얼이 흔들린다.
          stackY.value = stackY.value + dragOffset.value;
          dragOffset.value = 0;
          runOnJS(commitLine)(target);
        } else {
          dragOffset.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        }
      })
      .onFinalize(() => {
        'worklet';
        // onEnd 전에 취소된 제스처 뒷정리. onEnd 가 돌았으면 이미 0 이거나 되돌아가는 중이다.
        if (dragOffset.value !== 0) {
          dragOffset.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        }
        lastTarget.value = safeIndex;
        runOnJS(updatePreview)(null);
        runOnJS(setIsDragging)(false);
      }),
    [commitLine, dragOffset, dragStartIndex, lastTarget, lineCount, safeIndex, updatePreview],
  );

  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: stackY.value + dragOffset.value }],
  }));

  // 띠도 슬롯과 같은 축으로 줄어든다. 위치와 크기는 top/height 로 직접 넣는다 —
  // transform 안의 translateY 는 transformOrigin 에 같이 말려 들어가 어긋난다.
  const highlightStyle = useAnimatedStyle(() => ({
    top: highlightTop.value,
    height: highlightHeight.value,
    transform: [{
      scale: interpolate(dynamicProgress.value, [0, 1], [1, DYNAMIC_SCALE], Extrapolation.CLAMP),
    }],
    opacity: interpolate(
      dynamicProgress.value,
      [0, 1],
      [1, DYNAMIC_HIGHLIGHT_OPACITY],
      Extrapolation.CLAMP,
    ),
  }));

  // 후보 줄을 가운데 두고 그린다 — 멀리 끌어도 그 근처 줄들이 따라 나온다.
  const visibleIndexes = useMemo(() => {
    const out: number[] = [];
    const start = Math.max(0, candidateIndex - RENDER_RADIUS);
    const end = Math.min(lineCount - 1, candidateIndex + RENDER_RADIUS);
    for (let i = start; i <= end; i += 1) out.push(i);
    return out;
  }, [candidateIndex, lineCount]);

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.dial} onLayout={handleDialLayout}>
        <Animated.View style={[styles.stack, stackStyle]} pointerEvents="box-none">
          {/* 더미 안에 둬서 더미의 translateY 를 같이 받는다. */}
          <Animated.View
            style={[styles.focusHighlight, { transformOrigin: 'top' }, highlightStyle]}
            pointerEvents="none"
          />
          {visibleIndexes.map((index) => {
            const entry = entries[index];
            if (!entry) return null;
            const distance = Math.abs(index - candidateIndex);
            return (
              <Slot
                key={entry.key}
                entry={entry}
                isFocused={index === safeIndex}
                slotTop={slotLayouts[index]?.top ?? index * DEFAULT_LINE_HEIGHT}
                baseOpacity={DISTANCE_OPACITY[Math.min(distance, DISTANCE_OPACITY.length - 1)]}
                busyWordKey={busyWordKey}
                dynamicProgress={dynamicProgress}
                onMeasured={getOnMeasured(index)}
                onWordPress={onWordPress}
              />
            );
          })}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export default React.memo(SongLyricsDial);

const styles = StyleSheet.create({
  dial: {
    flex: 1,
    overflow: 'hidden',
  },
  stack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  slot: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  focusHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceSubtle,
  },
  restLineText: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.textPrimary,
  },
  focusBand: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 14,
  },
  focusPlainText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: 2,
    rowGap: 12,
  },
  tokenCell: {
    alignItems: 'center',
    gap: 2,
  },
  tokenCellBusy: {
    opacity: 0.5,
  },
  furiganaText: {
    fontSize: 9,
    lineHeight: 10,
    color: Colors.textSecondary,
  },
  tokenText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tokenTextMuted: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tokenBar: {
    alignSelf: 'stretch',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  tokenMeaningText: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textSecondary,
  },
  tokenMeaningTextMuted: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.textMuted,
  },
  lineMeaning: {
    gap: 4,
  },
  lineReadingText: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
    color: Colors.textSecondary,
  },
  lineKoreanText: {
    fontSize: 15.5,
    lineHeight: 22,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
});
