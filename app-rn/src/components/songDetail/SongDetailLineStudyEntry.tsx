import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { firstLockedPosition, type StudyLine } from '../lineStudy/studyLines';

const EQ_HEIGHT = 26;
const BAR_WIDTH = 4;
const BAR_GAP = 3;

/** 막대마다 높이 폭과 박자를 다르게 줘야 제각각 튀는 이퀄라이저로 보인다. 렌더마다 바뀌지 않게 인덱스로 정한다. */
function barRhythm(index: number) {
  const r = (seed: number) => {
    const x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    low: 0.12 + r(1) * 0.25,
    high: 0.55 + r(2) * 0.45,
    durationMs: 260 + r(3) * 360,
  };
}

const EqualizerBar = React.memo(function EqualizerBar({ index, playing }: { index: number; playing: boolean }) {
  const rhythm = useMemo(() => barRhythm(index), [index]);
  const level = useSharedValue(rhythm.low);
  useEffect(() => {
    if (!playing) {
      cancelAnimation(level);
      return;
    }
    level.value = withRepeat(withTiming(rhythm.high, { duration: rhythm.durationMs, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [level, playing, rhythm]);
  const bounce = useAnimatedStyle(() => ({ transform: [{ scaleY: level.value }] }));
  return <Animated.View style={[styles.bar, bounce]} />;
});

/** 노래를 틀어 두고 배우는 화면이라 카드 바닥에 재생 중 이퀄라이저를 띄워, 정적인 섹션 사이에서 눈이 먼저 가게 한다. */
const Equalizer = React.memo(function Equalizer() {
  const [width, setWidth] = useState(0);
  const handleLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);
  const count = Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP));
  // 막대마다 매 프레임 shadow tree commit 이 생긴다. 위에 줄 공부 화면이 덮여도 곡 상세는 마운트돼 있어 그대로 두면 그 화면까지 버벅인다.
  const focused = useIsFocused();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={handleLayout}>
      <View style={styles.equalizer}>
        {Array.from({ length: count }, (_, i) => <EqualizerBar key={i} index={i} playing={focused} />)}
      </View>
    </View>
  );
});

interface SongDetailLineStudyEntryProps {
  studyLines: readonly StudyLine[];
  onStart: () => void;
}

/**
 * 버튼 하나로는 무엇을 하는지 안 보여서, 들어가면 멈출 줄과 바로 앞 줄을 그대로 보여준다.
 * 왼쪽 레일은 재생 위치라 지나온 줄만 채운다.
 */
export const SongDetailLineStudyEntry = React.memo(function SongDetailLineStudyEntry({
  studyLines,
  onStart,
}: SongDetailLineStudyEntryProps) {
  const position = firstLockedPosition(studyLines);
  const current = studyLines[position];
  const previous = position > 0 ? studyLines[position - 1] : null;
  const translation = current.unseenCount === 0 ? current.line.koreanLyrics : null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>들으면서 공부해볼까요?</Text>
      <Pressable
        onPress={onStart}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${position + 1}번째 줄부터 듣기`}
      >
        <Equalizer />
        <View style={styles.lines}>
          {previous != null && (
            <View style={styles.line}>
              <View style={styles.rail}>
                <View style={[styles.railTrack, styles.railTrackPassed]} />
              </View>
              <Text style={styles.previousText} numberOfLines={1}>{previous.line.originalText}</Text>
            </View>
          )}
          <View style={styles.line}>
            <View style={styles.rail}>
              <View style={[styles.railTrack, styles.railTrackCurrent]} />
              <View style={styles.playhead} />
            </View>
            <View style={styles.currentBody}>
              <Text style={styles.currentText} numberOfLines={2}>{current.line.originalText}</Text>
              {translation != null ? (
                <Text style={styles.translation} numberOfLines={1}>{translation}</Text>
              ) : (
                <View style={styles.locked}>
                  <Ionicons name="lock-closed" size={11} color={Colors.textMuted} />
                  <Text style={styles.lockedLabel}>모르는 단어 {current.unseenCount}개</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.play}>
          <Ionicons name="play" size={18} color="#FFFFFF" style={styles.playIcon} />
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  title: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 19,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 14,
    paddingBottom: 34,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primaryShadow,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  equalizer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: EQ_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  // 바닥을 기준으로 늘어나야 막대가 위로만 튄다.
  bar: {
    width: BAR_WIDTH,
    height: EQ_HEIGHT,
    borderTopLeftRadius: BAR_WIDTH / 2,
    borderTopRightRadius: BAR_WIDTH / 2,
    backgroundColor: Colors.primary,
    opacity: 0.25,
    transformOrigin: 'bottom',
  },
  pressed: {
    opacity: 0.7,
  },
  lines: {
    flex: 1,
    gap: 8,
  },
  line: {
    flexDirection: 'row',
    gap: 10,
  },
  rail: {
    width: 8,
    alignItems: 'center',
  },
  railTrack: {
    position: 'absolute',
    top: -8,
    bottom: 0,
    width: 2,
  },
  railTrackPassed: {
    top: 0,
    bottom: -8,
    backgroundColor: Colors.primary,
  },
  railTrackCurrent: {
    top: 0,
    bottom: 0,
    backgroundColor: Colors.tierTrack,
  },
  playhead: {
    width: 8,
    height: 8,
    marginTop: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  previousText: {
    ...Typography.body,
    flex: 1,
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  currentBody: {
    flex: 1,
    gap: 4,
  },
  currentText: {
    ...Typography.bodySemiBold,
    color: Colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  translation: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedLabel: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    fontSize: 12,
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  // 재생 삼각형은 무게중심이 왼쪽이라 살짝 오른쪽으로 민다.
  playIcon: {
    marginLeft: 2,
  },
});
