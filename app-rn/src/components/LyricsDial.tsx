import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { StudyUnit, Token } from '../types/song';
import LyricLine, { LineState } from './LyricLine';
import { Colors } from '../theme/theme';

const SLOT_HEIGHT = 96;
const FOCUS_HEIGHT_BASE = SLOT_HEIGHT;
// Anchor the focus highlight 1.5 slots from the dial top — leaves ~1 prev
// line above and lets the rest of the dial below show upcoming lines.
const FOCUS_CENTER_Y = SLOT_HEIGHT * 1.5;
const TRANSITION_DURATION = 280;
const RENDER_RADIUS = 6;

interface Props {
  studyUnits: StudyUnit[];
  currentLineIndex: number;
  showTranslation: boolean;
  onTokenPress: (token: Token, lineText: string, koreanLyrics: string | null) => void;
  onStepLine: (newIndex: number) => void;
}

function LyricsDial({
  studyUnits,
  currentLineIndex,
  showTranslation,
  onTokenPress,
  onStepLine,
}: Props) {
  const safeIndex = Math.max(0, Math.min(studyUnits.length - 1, currentLineIndex));
  const lineCount = studyUnits.length;

  // Each line's natural rendered height (post-wrap) — used to grow the focus
  // highlight when the active line wraps to multiple visual rows.
  const [lineHeights, setLineHeights] = useState<Record<number, number>>({});

  // While dragging, the line currently inside the highlight zone (one step
  // ahead/behind safeIndex, or further). null = drag hasn't crossed any line
  // boundary yet (or no drag in progress) — safeIndex stays focused.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Focused line's slot expands to its measured height when wrapping makes
  // the content taller than SLOT_HEIGHT. This pushes lines below it down so
  // the focused content can't bleed into adjacent slots.
  const focusedSlotH = Math.max(SLOT_HEIGHT, lineHeights[safeIndex] ?? SLOT_HEIGHT);
  const focusedExtraH = focusedSlotH - SLOT_HEIGHT;

  const initialTarget = FOCUS_CENTER_Y - safeIndex * SLOT_HEIGHT - SLOT_HEIGHT / 2;
  const stackY = useSharedValue(initialTarget);
  const dragOffset = useSharedValue(0);
  // Tracks the rounded line-delta of the current drag — used to dedupe
  // runOnJS preview updates so we only fire when the highlighted line changes.
  const lastDelta = useSharedValue(0);

  const updatePreview = useCallback((idx: number | null) => {
    setPreviewIndex(prev => (prev === idx ? prev : idx));
  }, []);

  const commitLine = useCallback((newIdx: number) => {
    if (newIdx !== safeIndex) onStepLine(newIdx);
  }, [safeIndex, onStepLine]);

  // Slide the stack so that the focused line's slot center lands on
  // FOCUS_CENTER_Y. The focused slot may have grown beyond SLOT_HEIGHT, so we
  // factor in its actual height (focusedSlotH) when computing the target.
  useEffect(() => {
    const target = FOCUS_CENTER_Y - safeIndex * SLOT_HEIGHT - focusedSlotH / 2;
    stackY.value = withTiming(target, {
      duration: TRANSITION_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [safeIndex, focusedSlotH, stackY]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-20, 20])
        .onChange((e) => {
          'worklet';
          dragOffset.value = e.translationY;
          // Drag distance in slot-units → line delta. Drag up (negative)
          // moves to the next line (positive delta).
          const delta = -Math.round(e.translationY / SLOT_HEIGHT);
          if (delta !== lastDelta.value) {
            lastDelta.value = delta;
            const target = Math.max(0, Math.min(lineCount - 1, safeIndex + delta));
            runOnJS(updatePreview)(target === safeIndex ? null : target);
          }
        })
        .onEnd((e) => {
          'worklet';
          dragOffset.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
          const delta = -Math.round(e.translationY / SLOT_HEIGHT);
          const target = Math.max(0, Math.min(lineCount - 1, safeIndex + delta));
          lastDelta.value = 0;
          runOnJS(updatePreview)(null);
          if (target !== safeIndex) runOnJS(commitLine)(target);
        })
        .onFinalize(() => {
          'worklet';
          // Cleanup if the gesture is cancelled before onEnd (e.g. another
          // gesture wins). Avoids leaving a stale previewIndex.
          dragOffset.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
          lastDelta.value = 0;
          runOnJS(updatePreview)(null);
        }),
    [safeIndex, lineCount, dragOffset, lastDelta, updatePreview, commitLine],
  );

  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: stackY.value + dragOffset.value }],
  }));

  // Stable per-line callbacks so LyricLine.memo doesn't break each render.
  const onMeasuredCallbacks = useRef<Record<number, (h: number) => void>>({});
  const getOnMeasured = useCallback((idx: number) => {
    if (!onMeasuredCallbacks.current[idx]) {
      onMeasuredCallbacks.current[idx] = (h: number) => {
        setLineHeights(prev => (prev[idx] === h ? prev : { ...prev, [idx]: h }));
      };
    }
    return onMeasuredCallbacks.current[idx];
  }, []);

  // Render only a window around the active index for performance.
  const startIdx = Math.max(0, safeIndex - RENDER_RADIUS);
  const endIdx = Math.min(studyUnits.length - 1, safeIndex + RENDER_RADIUS);
  const visibleIndices: number[] = [];
  for (let i = startIdx; i <= endIdx; i++) visibleIndices.push(i);

  // Highlight tracks the line currently centered (preview during drag, or
  // safeIndex while settled). Height grows with that line so wrapped lines
  // are fully covered. Opacity drops while previewing for a softer cue.
  const focusLineIdx = previewIndex ?? safeIndex;
  const focusHeight = Math.max(FOCUS_HEIGHT_BASE, lineHeights[focusLineIdx] ?? FOCUS_HEIGHT_BASE);
  const focusTop = FOCUS_CENTER_Y - focusHeight / 2;
  const isPreviewing = previewIndex !== null;

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {/* Focus highlight — pinned on screen; height grows with active line. */}
        <View
          style={[
            styles.focusHighlight,
            {
              top: focusTop,
              height: focusHeight,
              opacity: isPreviewing ? 0.5 : 1,
            },
          ]}
          pointerEvents="none"
        />
        <Animated.View style={[styles.stack, stackStyle]} pointerEvents="box-none">
          {visibleIndices.map((idx) => {
            const unit = studyUnits[idx];
            if (!unit) return null;
            const lineState: LineState =
              idx === previewIndex ? 'previewing' :
              idx === safeIndex && previewIndex === null ? 'focused' :
              'inactive';
            const distance = Math.abs(idx - focusLineIdx);
            const opacity = lineState !== 'inactive' ? 1 : distance === 1 ? 0.55 : 0.3;
            // Slots after the focused one are pushed down by the focused
            // slot's overflow so a wrapped focused line doesn't overlap them.
            const slotTop = idx <= safeIndex
              ? idx * SLOT_HEIGHT
              : idx * SLOT_HEIGHT + focusedExtraH;
            const slotHeight = idx === safeIndex ? focusedSlotH : SLOT_HEIGHT;
            return (
              <View
                key={idx}
                style={[
                  styles.slot,
                  {
                    top: slotTop,
                    height: slotHeight,
                    opacity,
                  },
                ]}
                pointerEvents={lineState === 'focused' ? 'auto' : 'none'}
              >
                <LyricLine
                  studyUnit={unit}
                  state={lineState}
                  showTranslation={showTranslation}
                  onTokenPress={onTokenPress}
                  onMeasured={getOnMeasured(idx)}
                />
              </View>
            );
          })}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export default React.memo(LyricsDial);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Colors.background,
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
    justifyContent: 'center',
  },
  focusHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    borderRadius: 12,
  },
});
