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
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useLyricTranslationStore } from '../../stores/lyricTranslationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { convertLineReading } from '../../utils/readingConverter';
import ReportIcon from '../ReportIcon';
import { getSongDetailWordKey } from './songDetailWordSave';
import { hapticLineTick } from './lyricsHaptics';
import {
  DEFAULT_LINE_HEIGHT,
  TokenCell,
  buildSlotLayouts,
  buildTokenCells,
  slotPositionAt,
  stepTargetIndex,
} from './songLyricsDial';
import type { CurrentPlayingLyricLine, CurrentPlayingWord } from './CurrentPlayingWordsSheet';

/** 포커스 줄의 중심이 다이얼 높이의 어디에 오는지 — 위로 한 줄쯤, 아래로 다음 줄들. */
const FOCUS_CENTER_RATIO = 0.38;
/** 줄이 넘어갈 때 더미를 끄는 스프링 — 살짝 지나쳤다 돌아와 앉는다. */
const LINE_SPRING = { damping: 22, stiffness: 170, mass: 1 };
/** 아래 줄들이 한 박자 늦게 따라오게 하는 느슨한 스프링. */
const TRAIL_SPRING = { damping: 17, stiffness: 90, mass: 1 };
/** 포커스 아래 몇 줄에 걸쳐 꼬리가 다 늘어지는지. */
const TRAIL_SPREAD = 4;
const MODE_TIMING = { duration: 200, easing: Easing.out(Easing.cubic) };
/** 포커스가 옮겨 올 때 밑줄·단어 뜻·후리가나가 떠오르는 시간. 줄이 거의 앉은 뒤에 떠오른다. */
const DETAIL_FADE_IN_MS = 260;
const DETAIL_FADE_IN_DELAY_MS = 90;
const DETAIL_FADE_OUT_MS = 160;
/** 손을 뗀 뒤 후보 줄 기준이 옮겨 가는 시간. 물러남이 풀리는 동안만 밝기에 섞인다. */
const LINE_FADE_MS = 360;
/** 드래그 중 후보 줄로 띠가 미끄러지는 시간. */
const HIGHLIGHT_SLIDE_MS = 150;
const HIGHLIGHT_TIMING = { duration: HIGHLIGHT_SLIDE_MS, easing: Easing.out(Easing.cubic) };
const RENDER_RADIUS = 6;
/** 드래그하는 동안 가사 더미가 뒤로 물러나는 정도. */
const DYNAMIC_SCALE = 0.92;
const DYNAMIC_OPACITY = 0.85;
/** 앵커가 풀린 동안 띠는 옅어져 후보만 약하게 가리킨다. */
const DYNAMIC_HIGHLIGHT_OPACITY = 0.5;
/** 물러난 띠는 모서리를 둥글려 카드처럼 보이게 한다. */
const DYNAMIC_HIGHLIGHT_RADIUS = 14;
/** 포커스에서 멀어질수록 흐려진다. 마지막 값이 그 너머 전부. */
const DISTANCE_OPACITY = [1, 0.44, 0.3, 0.23, 0.18, 0.15, 0.13];
const DISTANCE_STEPS = DISTANCE_OPACITY.map((_, i) => i);

/** 다이얼은 흐린 앨범 커버 위 어두운 바탕에 놓인다. */
export const DarkText = {
  primary: '#FFFFFF',
  secondary: '#FFFFFFB8',
  muted: '#FFFFFF80',
} as const;

/** 진행 중인 애니메이션과 같은 곳으로 다시 보내면 건너뛴다 — 손 뗀 순간 UI 스레드가 먼저 출발시킨 걸 React 가 따라잡으며 다시 시작하지 않게. */
function springTo(
  value: SharedValue<number>,
  target: SharedValue<number>,
  to: number,
  config: typeof LINE_SPRING,
) {
  'worklet';
  if (Math.abs(target.value - to) < 0.5) return;
  target.value = to;
  value.value = withSpring(to, config);
}

function timeTo(value: SharedValue<number>, target: SharedValue<number>, to: number, duration: number) {
  'worklet';
  if (Math.abs(target.value - to) < 0.001) return;
  target.value = to;
  value.value = withTiming(to, { duration, easing: Easing.out(Easing.cubic) });
}

export interface SongLyricsDialEntry {
  key: string;
  line: CurrentPlayingLyricLine;
  words: CurrentPlayingWord[];
}

interface LineReportButtonProps {
  line: CurrentPlayingLyricLine;
  onPress: (line: CurrentPlayingLyricLine) => void;
}

const LineReportButton = React.memo(function LineReportButton({ line, onPress }: LineReportButtonProps) {
  const handlePress = useCallback(() => onPress(line), [line, onPress]);

  return (
    <Pressable
      style={styles.lineReportButton}
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="이 가사 제보"
    >
      <ReportIcon size={15} color={DarkText.muted} />
    </Pressable>
  );
});

interface LyricLineProps {
  line: CurrentPlayingLyricLine;
  isFocused: boolean;
  words: CurrentPlayingWord[];
  busyWordKey: string | null;
  onWordPress: (word: CurrentPlayingWord) => void;
  onReportLine?: (line: CurrentPlayingLyricLine) => void;
}

/**
 * 밑줄·단어 뜻·후리가나는 모든 줄에서 자리를 차지하고 포커스 줄에서만 보인다 —
 * 포커스가 옮겨 와도 높이와 글자 자리가 그대로다.
 */
const LyricLine = React.memo(function LyricLine({
  line,
  isFocused,
  words,
  busyWordKey,
  onWordPress,
  onReportLine,
}: LyricLineProps) {
  const showFurigana = useSettingsStore(s => s.showFurigana);
  const showKoreanPronunciation = useSettingsStore(s => s.showKoreanPronunciation);
  const showTranslation = useLyricTranslationStore(s => s.show);
  const cells = useMemo(() => buildTokenCells(line, words), [line, words]);
  // 토큰에서 조립한다 — 단어 사이는 띄고, 받침은 토큰 경계를 넘고, 장음은 넘지 않는다.
  const koreanPronunciation = useMemo(
    () => (showKoreanPronunciation
      ? convertLineReading(line.originalText, line.tokens ?? [], 'KOREAN')
      : ''),
    [line.originalText, line.tokens, showKoreanPronunciation],
  );
  const hasFurigana = showFurigana && cells.some(cell => cell.furigana);
  const hasMeaning = cells.some(cell => cell.meaning);
  const translation = showTranslation ? line.koreanLyrics : null;

  // 처음 그려질 때는 제자리 값으로 시작한다 — 창 안으로 들어온 줄이 깜빡이지 않게.
  const detailOpacity = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    detailOpacity.value = isFocused
      ? withDelay(
        DETAIL_FADE_IN_DELAY_MS,
        withTiming(1, { duration: DETAIL_FADE_IN_MS, easing: Easing.out(Easing.cubic) }),
      )
      : withTiming(0, { duration: DETAIL_FADE_OUT_MS, easing: Easing.out(Easing.quad) });
  }, [detailOpacity, isFocused]);
  const detailStyle = useAnimatedStyle(() => ({ opacity: detailOpacity.value }));

  return (
    <View style={styles.lineBand}>
      {/* 제보 버튼은 가사 줄 끝에 둔다 — 번역 옆에 두면 번역을 끄거나 없을 때 버튼만 남은 빈 줄이 생긴다. */}
      <View style={styles.lineTextRow}>
        {cells.length > 0 ? (
          <View style={styles.tokenRow}>
            {cells.map(cell => (
              <TokenCellView
                key={cell.key}
                cell={cell}
                showFurigana={hasFurigana}
                showMeaning={hasMeaning}
                detailStyle={detailStyle}
                isBusy={cell.word != null && busyWordKey === getSongDetailWordKey(cell.word)}
                onPress={onWordPress}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.plainText}>{line.originalText}</Text>
        )}
        {onReportLine ? (
          <Animated.View style={detailStyle}>
            <LineReportButton line={line} onPress={onReportLine} />
          </Animated.View>
        ) : null}
      </View>

      {koreanPronunciation || translation ? (
        <View style={styles.lineMeaning}>
          {koreanPronunciation ? (
            <Text style={styles.lineReadingText}>{koreanPronunciation}</Text>
          ) : null}
          {translation ? <Text style={styles.lineKoreanText}>{translation}</Text> : null}
        </View>
      ) : null}
    </View>
  );
});

interface TokenCellViewProps {
  cell: TokenCell;
  showFurigana: boolean;
  showMeaning: boolean;
  detailStyle: ReturnType<typeof useAnimatedStyle>;
  isBusy: boolean;
  onPress: (word: CurrentPlayingWord) => void;
}

const TokenCellView = React.memo(function TokenCellView({
  cell,
  showFurigana,
  showMeaning,
  detailStyle,
  isBusy,
  onPress,
}: TokenCellViewProps) {
  const handlePress = useCallback(() => {
    if (cell.word) onPress(cell.word);
  }, [cell.word, onPress]);

  const body = (
    <View style={styles.tokenCell}>
      {showFurigana ? (
        <Animated.Text style={[styles.furiganaText, detailStyle]} numberOfLines={1}>
          {cell.furigana ?? ' '}
        </Animated.Text>
      ) : null}
      <Text style={cell.barColor ? styles.tokenText : styles.tokenTextMuted}>{cell.text}</Text>
      <Animated.View
        style={[
          styles.tokenBar,
          cell.barColor ? { backgroundColor: cell.barColor } : null,
          detailStyle,
        ]}
      />
      {showMeaning ? (
        <Animated.Text
          style={[
            cell.barColor ? styles.tokenMeaningText : styles.tokenMeaningTextMuted,
            detailStyle,
          ]}
        >
          {cell.meaning ?? ' '}
        </Animated.Text>
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
  index: number;
  isFocused: boolean;
  slotTop: number;
  busyWordKey: string | null;
  focusPosition: SharedValue<number>;
  dynamicProgress: SharedValue<number>;
  stackY: SharedValue<number>;
  trailY: SharedValue<number>;
  onMeasured: (height: number) => void;
  onWordPress: (word: CurrentPlayingWord) => void;
  onReportLine?: (line: CurrentPlayingLyricLine) => void;
}

const Slot = React.memo(function Slot({
  entry,
  index,
  isFocused,
  slotTop,
  busyWordKey,
  focusPosition,
  dynamicProgress,
  stackY,
  trailY,
  onMeasured,
  onWordPress,
  onReportLine,
}: SlotProps) {
  // 슬롯마다 자기 위쪽을 축으로 줄어든다 — 더미 전체를 한 점으로 모으면 먼 줄이 눈에
  // 띄게 밀린다. 흐리기는 거리에 따른 기본값과 드래그 중 물러남을 곱한다.
  // 거리는 UI 스레드에서 잰다 — prop 으로 넘기면 줄이 바뀔 때마다 창 안 슬롯이 전부 다시 그려진다.
  // 포커스 아래 줄일수록 느슨한 스프링 쪽으로 섞어 한 박자씩 늦게 따라온다. 두 스프링은 같은 자리에서
  // 떠나 같은 자리에 앉으므로 줄 사이가 벌어진 채로 남지 않는다.
  const animStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: (trailY.value - stackY.value) * interpolate(
        index - focusPosition.value,
        [0, TRAIL_SPREAD],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    }, {
      scale: interpolate(dynamicProgress.value, [0, 1], [1, DYNAMIC_SCALE], Extrapolation.CLAMP),
    }],
    opacity: interpolate(
      Math.abs(index - focusPosition.value),
      DISTANCE_STEPS,
      DISTANCE_OPACITY,
      Extrapolation.CLAMP,
    ) * interpolate(dynamicProgress.value, [0, 1], [1, DYNAMIC_OPACITY], Extrapolation.CLAMP),
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
      <LyricLine
        line={entry.line}
        isFocused={isFocused}
        words={entry.words}
        busyWordKey={isFocused ? busyWordKey : null}
        onWordPress={onWordPress}
        onReportLine={onReportLine}
      />
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
  /** 포커스 줄의 제보 버튼. 없으면 버튼을 그리지 않는다. */
  onReportLine?: (line: CurrentPlayingLyricLine) => void;
}

function SongLyricsDial({
  entries,
  focusedIndex,
  busyWordKey,
  onStepLine,
  onWordPress,
  onReportLine,
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
  const trailY = useSharedValue(0);
  const stackTarget = useSharedValue(0);
  const trailTarget = useSharedValue(0);
  const dragOffset = useSharedValue(0);
  // 드래그를 시작한 줄. 싱크 중엔 드래그하는 동안에도 포커스가 넘어가므로 그 기준을 붙잡아 둔다.
  const dragStartIndex = useSharedValue(safeIndex);
  // 지금 드래그가 가리키는 줄 — worklet 안에서 runOnJS 중복 호출을 걸러낸다.
  const lastTarget = useSharedValue(safeIndex);
  const dynamicProgress = useSharedValue(0);
  const highlightTop = useSharedValue(candidateSlotTop);
  const highlightHeight = useSharedValue(candidateSlotHeight);
  const candidatePosition = useSharedValue(candidateIndex);
  const candidateTarget = useSharedValue(candidateIndex);
  // 손을 떼는 순간 UI 스레드에서 바로 다음 줄로 출발시키려고 배치를 그쪽에도 둔다.
  const slotLayoutsSV = useSharedValue(slotLayouts);
  const focusCenterSV = useSharedValue(focusCenterY);
  useEffect(() => {
    slotLayoutsSV.value = slotLayouts;
  }, [slotLayouts, slotLayoutsSV]);
  useEffect(() => {
    focusCenterSV.value = focusCenterY;
  }, [focusCenterSV, focusCenterY]);
  // 제스처를 줄마다 다시 만들지 않도록 worklet 은 포커스 줄을 여기서 읽는다.
  const focusIndex = useSharedValue(safeIndex);
  useEffect(() => {
    focusIndex.value = safeIndex;
  }, [focusIndex, safeIndex]);

  const updatePreview = useCallback((index: number | null) => {
    setPreviewIndex(prev => (prev === index ? prev : index));
  }, []);

  // 후보 지우기와 줄 넘기기를 한 번에 해야 한 번에 그려진다 — 따로 하면 띠가 옛 줄로 갔다가 돌아온다.
  const commitLine = useCallback((index: number) => {
    setPreviewIndex(null);
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

  // 줄 수가 바뀔 때만 지운다. 단어만 다시 내려온 경우 지우면 다이얼이 흔들린다.
  useEffect(() => {
    setLineHeights({});
  }, [lineCount]);

  // 첫 자리잡기만 애니메이션 없이 바로 앉힌다.
  const hasPositionedRef = useRef(false);
  useEffect(() => {
    if (dialHeight === 0) return;
    const target = focusCenterY - safeSlotTop - safeSlotHeight / 2;
    if (!hasPositionedRef.current) {
      hasPositionedRef.current = true;
      stackY.value = target;
      trailY.value = target;
      stackTarget.value = target;
      trailTarget.value = target;
      return;
    }
    springTo(stackY, stackTarget, target, LINE_SPRING);
    springTo(trailY, trailTarget, target, TRAIL_SPRING);
    // 드래그가 끝날 때도 다시 맞춘다 — 손 뗀 줄을 부모가 받지 않았으면(싱크 시각 없는 줄) 제자리로 돌아온다.
  }, [
    isDragging,
    dialHeight,
    focusCenterY,
    safeSlotHeight,
    safeSlotTop,
    stackTarget,
    stackY,
    trailTarget,
    trailY,
  ]);

  useEffect(() => {
    timeTo(
      candidatePosition,
      candidateTarget,
      candidateIndex,
      isDragging ? HIGHLIGHT_SLIDE_MS : LINE_FADE_MS,
    );
  }, [candidateIndex, candidatePosition, candidateTarget, isDragging]);

  const panGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetY([-12, 12])
      .failOffsetX([-20, 20])
      .onStart(() => {
        'worklet';
        dragStartIndex.value = focusIndex.value;
        lastTarget.value = focusIndex.value;
        // 띠·물러남은 JS 를 거치지 않고 여기서 바로 움직인다 — 다시 그리기를 기다리면 띠가 늦게 따라온다.
        const slot = slotLayoutsSV.value[focusIndex.value];
        if (slot) {
          highlightTop.value = slot.top;
          highlightHeight.value = slot.height;
        }
        dynamicProgress.value = withTiming(1, MODE_TIMING);
        runOnJS(setIsDragging)(true);
      })
      .onChange((event) => {
        'worklet';
        dragOffset.value = event.translationY;
        const startIndex = dragStartIndex.value;
        const target = stepTargetIndex(startIndex, event.translationY, lineCount);
        if (target !== lastTarget.value) {
          lastTarget.value = target;
          const slot = slotLayoutsSV.value[target];
          if (slot) {
            highlightTop.value = withTiming(slot.top, HIGHLIGHT_TIMING);
            highlightHeight.value = withTiming(slot.height, HIGHLIGHT_TIMING);
          }
          timeTo(candidatePosition, candidateTarget, target, HIGHLIGHT_SLIDE_MS);
          runOnJS(updatePreview)(target === startIndex ? null : target);
          // 손으로 넘길 때만 울린다. 재생으로 넘어가는 줄은 조용히 지나간다.
          runOnJS(hapticLineTick)();
        }
      })
      .onEnd((event) => {
        'worklet';
        const startIndex = dragStartIndex.value;
        const target = stepTargetIndex(startIndex, event.translationY, lineCount);
        lastTarget.value = startIndex;
        if (target !== startIndex) {
          // 드래그 값을 stackY 에 흡수시켜 손을 뗀 자리에서 이어 움직인다. 안 그러면 다이얼이 흔들린다.
          stackY.value = stackY.value + dragOffset.value;
          trailY.value = trailY.value + dragOffset.value;
          dragOffset.value = 0;
          // JS 가 다시 그릴 때까지 기다리지 않고 여기서 바로 다음 줄로 출발한다.
          const slot = slotLayoutsSV.value[target];
          if (slot) {
            const to = focusCenterSV.value - slot.top - slot.height / 2;
            stackTarget.value = to;
            trailTarget.value = to;
            stackY.value = withSpring(to, LINE_SPRING);
            trailY.value = withSpring(to, TRAIL_SPRING);
          }
          timeTo(candidatePosition, candidateTarget, target, LINE_FADE_MS);
          runOnJS(commitLine)(target);
        } else {
          runOnJS(updatePreview)(null);
          dragOffset.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        }
      })
      .onFinalize(() => {
        'worklet';
        // onEnd 전에 취소된 제스처 뒷정리. onEnd 가 돌았으면 이미 0 이거나 되돌아가는 중이다.
        if (dragOffset.value !== 0) {
          dragOffset.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        }
        lastTarget.value = focusIndex.value;
        dynamicProgress.value = withTiming(0, MODE_TIMING);
        runOnJS(setIsDragging)(false);
      }),
    [
      candidatePosition,
      candidateTarget,
      commitLine,
      dragOffset,
      dragStartIndex,
      focusCenterSV,
      dynamicProgress,
      focusIndex,
      highlightHeight,
      highlightTop,
      lastTarget,
      lineCount,
      slotLayoutsSV,
      stackTarget,
      stackY,
      trailTarget,
      trailY,
      updatePreview,
    ],
  );

  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: stackY.value + dragOffset.value }],
  }));

  // 가만히 있을 때 화면 가운데 놓인 줄 — 띠와 같은 더미 위치에서 읽는다. 밝기를 따로 굴리면 빠르게 넘길 때
  // 띠만 새 줄로 가고 밝기는 옛 줄에 남는다.
  const restPosition = useDerivedValue(
    () => slotPositionAt(slotLayoutsSV.value, focusCenterSV.value - stackY.value),
  );
  // 줄 밝기·꼬리가 재는 기준. 띠처럼 가만히 있을 땐 더미 위치, 드래그 중엔 후보 줄을 따른다.
  const focusPosition = useDerivedValue(() => interpolate(
    dynamicProgress.value,
    [0, 1],
    [restPosition.value, candidatePosition.value],
  ));

  // 가만히 있을 때 띠 높이 — 가운데 줄이 옮겨 가는 만큼 두 줄 높이 사이를 오간다.
  const restHeight = useDerivedValue(() => {
    const layouts = slotLayoutsSV.value;
    const p = restPosition.value;
    const from = layouts[Math.floor(p)]?.height ?? DEFAULT_LINE_HEIGHT;
    const to = layouts[Math.ceil(p)]?.height ?? from;
    return from + (to - from) * (p - Math.floor(p));
  });

  // 위치와 크기는 top/height 로 넣는다 — transform 의 translateY 는 transformOrigin 에 말려 어긋난다.
  // 가만히 있을 땐 더미 위치에서 거꾸로 셈해 늘 화면 가운데에 둔다 — 따로 굴린 띠 값은 빠르게 넘길 때
  // 스레드 사이 순서가 엇갈려 옛 줄에 남을 수 있다. 드래그 중에만 후보 줄을 따라간다.
  const highlightStyle = useAnimatedStyle(() => ({
    top: interpolate(
      dynamicProgress.value,
      [0, 1],
      [focusCenterSV.value - stackY.value - restHeight.value / 2, highlightTop.value],
    ),
    height: interpolate(dynamicProgress.value, [0, 1], [restHeight.value, highlightHeight.value]),
    transform: [{
      scale: interpolate(dynamicProgress.value, [0, 1], [1, DYNAMIC_SCALE], Extrapolation.CLAMP),
    }],
    opacity: interpolate(
      dynamicProgress.value,
      [0, 1],
      [1, DYNAMIC_HIGHLIGHT_OPACITY],
      Extrapolation.CLAMP,
    ),
    borderRadius: interpolate(
      dynamicProgress.value,
      [0, 1],
      [0, DYNAMIC_HIGHLIGHT_RADIUS],
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
            return (
              <Slot
                key={entry.key}
                entry={entry}
                index={index}
                isFocused={index === safeIndex}
                slotTop={slotLayouts[index]?.top ?? index * DEFAULT_LINE_HEIGHT}
                busyWordKey={busyWordKey}
                focusPosition={focusPosition}
                dynamicProgress={dynamicProgress}
                stackY={stackY}
                trailY={trailY}
                onMeasured={getOnMeasured(index)}
                onWordPress={onWordPress}
                onReportLine={onReportLine}
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
    backgroundColor: '#FFFFFF14',
  },
  lineBand: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 6,
  },
  lineTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plainText: {
    flex: 1,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: DarkText.primary,
  },
  tokenRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: 1,
    rowGap: 6,
  },
  tokenCell: {
    alignItems: 'center',
    gap: 1,
  },
  tokenCellBusy: {
    opacity: 0.5,
  },
  furiganaText: {
    fontSize: 9,
    lineHeight: 10,
    color: DarkText.secondary,
  },
  tokenText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: DarkText.primary,
  },
  tokenTextMuted: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: DarkText.secondary,
  },
  tokenBar: {
    alignSelf: 'stretch',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  tokenMeaningText: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    color: DarkText.secondary,
  },
  tokenMeaningTextMuted: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    color: DarkText.muted,
  },
  lineMeaning: {
    gap: 2,
  },
  lineReadingText: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
    color: DarkText.secondary,
  },
  lineReportButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineKoreanText: {
    fontSize: 15,
    lineHeight: 21,
    color: DarkText.secondary,
  },
});
