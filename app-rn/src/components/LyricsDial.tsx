import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { StudyUnit, Token } from '../types/song';
import LyricLine from './LyricLine';
import { Colors } from '../theme/theme';

const SWIPE_THRESHOLD_PX = 40;
const SWIPE_VELOCITY = 350;

const VISIBLE_OFFSETS: ReadonlyArray<{ offset: number; opacity: number }> = [
  { offset: -1, opacity: 0.32 },
  { offset: 0, opacity: 1 },
  { offset: 1, opacity: 0.6 },
  { offset: 2, opacity: 0.32 },
];

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
  const stepBy = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(studyUnits.length - 1, currentLineIndex + delta));
      if (next !== currentLineIndex) onStepLine(next);
    },
    [currentLineIndex, studyUnits.length, onStepLine],
  );

  const stepNext = useCallback(() => stepBy(1), [stepBy]);
  const stepPrev = useCallback(() => stepBy(-1), [stepBy]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .failOffsetX([-20, 20])
        .onEnd((e) => {
          'worklet';
          const dy = e.translationY;
          const vy = e.velocityY;
          if (dy < -SWIPE_THRESHOLD_PX || vy < -SWIPE_VELOCITY) {
            runOnJS(stepNext)();
          } else if (dy > SWIPE_THRESHOLD_PX || vy > SWIPE_VELOCITY) {
            runOnJS(stepPrev)();
          }
        }),
    [stepNext, stepPrev],
  );

  const safeIndex = currentLineIndex < 0 ? 0 : currentLineIndex;

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {VISIBLE_OFFSETS.map(({ offset, opacity }) => {
          const idx = safeIndex + offset;
          const unit = studyUnits[idx];
          if (!unit) return <View key={offset} />;
          return (
            <View key={offset} style={[styles.row, { opacity }]} pointerEvents={offset === 0 ? 'auto' : 'none'}>
              <LyricLine
                studyUnit={unit}
                isActive={offset === 0}
                showTranslation={showTranslation}
                onTokenPress={onTokenPress}
              />
            </View>
          );
        })}
      </View>
    </GestureDetector>
  );
}

export default React.memo(LyricsDial);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  row: {
    width: '100%',
    alignItems: 'center',
  },
});
