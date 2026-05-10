import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { StudyUnit, Token } from '../types/song';
import LyricLine from './LyricLine';
import { Colors } from '../theme/theme';

const SLOT_HEIGHT = 96;
// Anchor the focused slot's center 1.5 slots from the dial top — leaves
// ~1 prev line above and lets the rest of the dial below show upcoming lines.
const FOCUS_CENTER_Y = SLOT_HEIGHT * 1.5;
const TRANSITION_DURATION = 280;
const MODE_DURATION = 200;
const RENDER_RADIUS = 6;
// Recede effect applied to the lyric stack while the user is dragging.
const DYNAMIC_SCALE = 0.92;
const DYNAMIC_OPACITY = 0.85;
// Highlight bg fades when in dynamic mode (anchor released, candidate
// emphasized only weakly).
const DYNAMIC_HIGHLIGHT_OPACITY = 0.5;

interface Props {
  studyUnits: StudyUnit[];
  currentLineIndex: number;
  showTranslation: boolean;
  onTokenPress: (token: Token, lineText: string, koreanLyrics: string | null) => void;
  onStepLine: (newIndex: number) => void;
}

interface SlotProps {
  unit: StudyUnit;
  isLineFocused: boolean;
  showTranslation: boolean;
  onTokenPress: (token: Token, lineText: string, koreanLyrics: string | null) => void;
  onMeasured: (height: number) => void;
  slotTop: number;
  slotHeight: number;
  baseOpacity: number;
  dynamicProgress: SharedValue<number>;
}

function Slot({
  unit,
  isLineFocused,
  showTranslation,
  onTokenPress,
  onMeasured,
  slotTop,
  slotHeight,
  baseOpacity,
  dynamicProgress,
}: SlotProps) {
  // Per-slot animation: scale around the slot's top so the line shrinks
  // downward in place (top edge stays put). Opacity compounds the static
  // distance fade with the dynamic-mode recede fade.
  const animStyle = useAnimatedStyle(() => {
    const s = interpolate(dynamicProgress.value, [0, 1], [1, DYNAMIC_SCALE], Extrapolation.CLAMP);
    const dyn = interpolate(dynamicProgress.value, [0, 1], [1, DYNAMIC_OPACITY], Extrapolation.CLAMP);
    return {
      transform: [{ scale: s }],
      opacity: baseOpacity * dyn,
    };
  });
  return (
    <Animated.View
      style={[
        styles.slot,
        { top: slotTop, height: slotHeight, transformOrigin: 'top' },
        animStyle,
      ]}
      pointerEvents={isLineFocused ? 'auto' : 'none'}
    >
      <LyricLine
        studyUnit={unit}
        isActive={isLineFocused}
        showTranslation={showTranslation}
        onTokenPress={onTokenPress}
        onMeasured={onMeasured}
      />
    </Animated.View>
  );
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

  // Each line's natural rendered height — used to size the focus highlight
  // and to expand the focused slot so wrapped lines don't bleed into neighbors.
  // Lines render with their static-mode style regardless of mode (the safeIndex
  // line keeps its focused style even while dragging) so these measurements
  // stay stable across the static↔dynamic transition.
  const [lineHeights, setLineHeights] = useState<Record<number, number>>({});

  // Drag state. isDragging gates the static↔dynamic mode transition; the
  // animation itself is driven by `dynamicProgress` (0=static, 1=dynamic).
  const [isDragging, setIsDragging] = useState(false);
  // Candidate line currently sitting in the highlight zone during drag.
  // null = drag hasn't crossed any line boundary (highlight still over safeIndex).
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Static-mode focused slot expands to fit the wrapped focused line. Same
  // value applies in dynamic mode since text styling doesn't change.
  const focusedSlotH = Math.max(SLOT_HEIGHT, lineHeights[safeIndex] ?? SLOT_HEIGHT);
  const focusedExtraH = focusedSlotH - SLOT_HEIGHT;

  const initialTarget = FOCUS_CENTER_Y - safeIndex * SLOT_HEIGHT - SLOT_HEIGHT / 2;
  const stackY = useSharedValue(initialTarget);
  const dragOffset = useSharedValue(0);
  // Rounded line-delta of the current drag — used in the worklet to dedupe
  // runOnJS preview updates.
  const lastDelta = useSharedValue(0);
  const dynamicProgress = useSharedValue(0);

  const updatePreview = useCallback((idx: number | null) => {
    setPreviewIndex(prev => (prev === idx ? prev : idx));
  }, []);

  const commitLine = useCallback((newIdx: number) => {
    if (newIdx !== safeIndex) onStepLine(newIdx);
  }, [safeIndex, onStepLine]);

  // Animate dynamicProgress on drag start/end. Drives stack scale/opacity and
  // highlight opacity simultaneously.
  useEffect(() => {
    dynamicProgress.value = withTiming(isDragging ? 1 : 0, {
      duration: MODE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [isDragging, dynamicProgress]);

  // Slide the stack so that the focused slot's center lands on FOCUS_CENTER_Y.
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
        .onStart(() => {
          'worklet';
          runOnJS(setIsDragging)(true);
        })
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
          const delta = -Math.round(e.translationY / SLOT_HEIGHT);
          const target = Math.max(0, Math.min(lineCount - 1, safeIndex + delta));
          lastDelta.value = 0;
          runOnJS(updatePreview)(null);
          if (target !== safeIndex) {
            // Absorb the current drag offset into stackY so the post-commit
            // animation starts from the user's release position, not from
            // the pre-drag baseline. Without this the dial wobbles: drag
            // springs back to 0 while stackY independently slides to the new
            // line, giving a non-monotonic path.
            stackY.value = stackY.value + dragOffset.value;
            dragOffset.value = 0;
            runOnJS(commitLine)(target);
          } else {
            // No commit — bounce the drag back to baseline.
            dragOffset.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
          }
        })
        .onFinalize(() => {
          'worklet';
          // Cleanup if the gesture was cancelled before onEnd. If onEnd ran,
          // dragOffset is already 0 (committed) or animating back (no-op).
          if (dragOffset.value !== 0) {
            dragOffset.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
          }
          lastDelta.value = 0;
          runOnJS(updatePreview)(null);
          runOnJS(setIsDragging)(false);
        }),
    [safeIndex, lineCount, dragOffset, lastDelta, updatePreview, commitLine],
  );

  // Stack only translates — the recede scale is applied per-slot so each
  // line shrinks in place rather than converging toward a single pivot
  // (which made distant lines drift visibly when entering dynamic mode).
  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: stackY.value + dragOffset.value }],
  }));

  // Highlight scales the same way slots do (transformOrigin: 'top') so it
  // visually matches the candidate line's recede shrink. Opacity fades as
  // we enter dynamic mode (anchor releases).
  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(dynamicProgress.value, [0, 1], [1, DYNAMIC_SCALE], Extrapolation.CLAMP) }],
    opacity: interpolate(dynamicProgress.value, [0, 1], [1, DYNAMIC_HIGHLIGHT_OPACITY], Extrapolation.CLAMP),
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

  // Candidate is the line the highlight pins itself to: safeIndex while
  // settled, previewIndex during a drag that has crossed a line boundary.
  const candidateIdx = previewIndex ?? safeIndex;

  // Render window centers on candidateIdx so far drags keep showing the
  // lines around the current scroll position (rather than only ±RADIUS
  // around the still-anchored safeIndex).
  const startIdx = Math.max(0, candidateIdx - RENDER_RADIUS);
  const endIdx = Math.min(studyUnits.length - 1, candidateIdx + RENDER_RADIUS);
  const visibleIndices: number[] = [];
  for (let i = startIdx; i <= endIdx; i++) visibleIndices.push(i);
  const candidateSlotTop = candidateIdx <= safeIndex
    ? candidateIdx * SLOT_HEIGHT
    : candidateIdx * SLOT_HEIGHT + focusedExtraH;
  const candidateSlotH = candidateIdx === safeIndex ? focusedSlotH : SLOT_HEIGHT;

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        <Animated.View style={[styles.stack, stackStyle]} pointerEvents="box-none">
          {/* Focus highlight — placed inside the stack so it inherits the
              stack's translateY, then sized/positioned to match the current
              candidate slot. Crosses lines via discrete top/height updates
              when previewIndex switches at the half-slot threshold. */}
          <Animated.View
            style={[
              styles.focusHighlight,
              {
                top: candidateSlotTop,
                height: candidateSlotH,
                transformOrigin: 'top',
              },
              highlightStyle,
            ]}
            pointerEvents="none"
          />
          {visibleIndices.map((idx) => {
            const unit = studyUnits[idx];
            if (!unit) return null;
            // safeIndex line keeps its focused style in both modes — the
            // anchor-released feel is conveyed via the recede transform and
            // the highlight bg fading, not by re-styling the text. This way
            // the line's measured height (and thus its on-screen position)
            // stays stable across the mode transition.
            const isLineFocused = idx === safeIndex;
            const distance = Math.abs(idx - candidateIdx);
            const baseOpacity = isLineFocused ? 1 : distance === 1 ? 0.55 : 0.3;
            // Slots after the focused one are pushed down by its overflow so
            // a wrapped focused line doesn't overlap them.
            const slotTop = idx <= safeIndex
              ? idx * SLOT_HEIGHT
              : idx * SLOT_HEIGHT + focusedExtraH;
            const slotHeight = idx === safeIndex ? focusedSlotH : SLOT_HEIGHT;
            return (
              <Slot
                key={idx}
                unit={unit}
                isLineFocused={isLineFocused}
                showTranslation={showTranslation}
                onTokenPress={onTokenPress}
                onMeasured={getOnMeasured(idx)}
                slotTop={slotTop}
                slotHeight={slotHeight}
                baseOpacity={baseOpacity}
                dynamicProgress={dynamicProgress}
              />
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
