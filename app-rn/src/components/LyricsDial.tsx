import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { StudyUnit, Token } from '../types/song';
import LyricLine from './LyricLine';
import { Colors } from '../theme/theme';

const SLOT_HEIGHT = 96;
const SWIPE_THRESHOLD_PX = 40;
const SWIPE_VELOCITY = 350;
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
  const [containerH, setContainerH] = useState(0);

  const stackY = useSharedValue(0);
  const dragOffset = useSharedValue(0);
  const isInitialized = useRef(false);

  const stepBy = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(studyUnits.length - 1, safeIndex + delta));
      if (next !== safeIndex) onStepLine(next);
    },
    [safeIndex, studyUnits.length, onStepLine],
  );

  const stepNext = useCallback(() => stepBy(1), [stepBy]);
  const stepPrev = useCallback(() => stepBy(-1), [stepBy]);

  // Animate the stack so that the active line slot is centered in the container.
  // Each slot lives at absolute top = idx * SLOT_HEIGHT inside the stack.
  // We want slot[safeIndex] center (idx*SLOT_HEIGHT + SLOT_HEIGHT/2) at containerH/2.
  // So stackY = containerH/2 - (safeIndex + 0.5) * SLOT_HEIGHT.
  useEffect(() => {
    if (containerH === 0) return;
    const target = containerH / 2 - (safeIndex + 0.5) * SLOT_HEIGHT;
    if (!isInitialized.current) {
      stackY.value = target;
      isInitialized.current = true;
    } else {
      stackY.value = withTiming(target, {
        duration: TRANSITION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [safeIndex, containerH, stackY]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-20, 20])
        .onChange((e) => {
          'worklet';
          dragOffset.value = e.translationY;
        })
        .onEnd((e) => {
          'worklet';
          const dy = e.translationY;
          const vy = e.velocityY;
          dragOffset.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
          if (dy < -SWIPE_THRESHOLD_PX || vy < -SWIPE_VELOCITY) {
            runOnJS(stepNext)();
          } else if (dy > SWIPE_THRESHOLD_PX || vy > SWIPE_VELOCITY) {
            runOnJS(stepPrev)();
          }
        }),
    [stepNext, stepPrev, dragOffset],
  );

  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: stackY.value + dragOffset.value }],
  }));

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h !== containerH) setContainerH(h);
  }, [containerH]);

  // Render only a window around the active index for performance.
  const startIdx = Math.max(0, safeIndex - RENDER_RADIUS);
  const endIdx = Math.min(studyUnits.length - 1, safeIndex + RENDER_RADIUS);
  const visibleIndices: number[] = [];
  for (let i = startIdx; i <= endIdx; i++) visibleIndices.push(i);

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container} onLayout={handleLayout}>
        <Animated.View style={[styles.stack, stackStyle]} pointerEvents="box-none">
          {visibleIndices.map((idx) => {
            const unit = studyUnits[idx];
            if (!unit) return null;
            const isActive = idx === safeIndex;
            const distance = Math.abs(idx - safeIndex);
            const opacity = isActive ? 1 : distance === 1 ? 0.55 : 0.3;
            return (
              <View
                key={idx}
                style={[
                  styles.slot,
                  {
                    top: idx * SLOT_HEIGHT,
                    opacity,
                  },
                ]}
                pointerEvents={isActive ? 'auto' : 'none'}
              >
                <LyricLine
                  studyUnit={unit}
                  isActive={isActive}
                  showTranslation={showTranslation}
                  onTokenPress={onTokenPress}
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
    height: SLOT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
