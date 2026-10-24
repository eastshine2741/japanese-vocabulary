import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { firstLockedPosition, type StudyLine } from '../lineStudy/studyLines';

const WAVE_HEIGHT = 52;
const WAVES = [
  { periods: 2, amplitude: 11, durationMs: 4200, opacity: 0.10 },
  { periods: 3, amplitude: 8, durationMs: 2800, opacity: 0.14 },
  { periods: 4, amplitude: 5, durationMs: 1900, opacity: 0.18 },
] as const;

/** 가로 2배 길이에 같은 파형을 두 번 그려, 한 폭만큼 밀었다 되돌려도 이음매가 안 보인다. */
function wavePath(width: number, periods: number, amplitude: number): string {
  const omega = (2 * Math.PI * periods) / width;
  let d = `M0 ${WAVE_HEIGHT}`;
  for (let x = 0; x <= width * 2; x += 4) {
    d += ` L${x} ${(amplitude * (1 - Math.sin(omega * x))).toFixed(1)}`;
  }
  return `${d} L${width * 2} ${WAVE_HEIGHT} Z`;
}

const WaveLayer = React.memo(function WaveLayer({ width, wave }: { width: number; wave: typeof WAVES[number] }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: wave.durationMs, easing: Easing.linear }), -1);
  }, [progress, wave.durationMs]);
  const flow = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.value - 1) * width }] }));
  const d = useMemo(() => wavePath(width, wave.periods, wave.amplitude), [width, wave.periods, wave.amplitude]);
  return (
    <Animated.View style={[styles.waveLayer, { width: width * 2 }, flow]}>
      <Svg width={width * 2} height={WAVE_HEIGHT}>
        <Path d={d} fill={Colors.primary} fillOpacity={wave.opacity} />
      </Svg>
    </Animated.View>
  );
});

/** 노래를 틀어 두고 배우는 화면이라 카드 바닥에 파형이 흐르게 해, 정적인 섹션 사이에서 눈이 먼저 가게 한다. */
const FlowingWaves = React.memo(function FlowingWaves() {
  const [width, setWidth] = useState(0);
  const handleLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={handleLayout}>
      {width > 0 && WAVES.map((wave, i) => <WaveLayer key={i} width={width} wave={wave} />)}
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
        <FlowingWaves />
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
    paddingBottom: 22,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primaryShadow,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  waveLayer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: WAVE_HEIGHT,
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
