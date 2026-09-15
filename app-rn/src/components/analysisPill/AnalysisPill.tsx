import React, { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import ArtworkImage from '../ArtworkImage';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { PillState } from './pillState';

// component/AnalyzingPill (Pencil XjTJZ). 접힌 pill 과 펼친 곡별 pill 이 같은 컴포넌트를 쓴다.
// 상태가 바뀌면 그 자리에서 변한다: 색은 tone 으로 보간, 글자는 새 글자가 페이드인, 아트 개수·폭 변화는 layout 전환.
// 아트 테두리는 두지 않는다.

export const PILL_HEIGHT = 56;
const ART_SIZE = 40;
const ART_OVERLAP_OFFSET = 26;
const PRESSED_SCALE = 0.96;
const TONE_DURATION = 360;
const RELAYOUT_DURATION = 260;
const TEXT_FADE_DURATION = 220;

const relayout = LinearTransition.duration(RELAYOUT_DURATION).easing(Easing.out(Easing.cubic));
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  state: PillState;
  onPress: () => void;
}

function AnalysisPill({ state, onPress }: Props) {
  const done = state.tone === 'done';

  const spin = useSharedValue(0);
  useEffect(() => {
    if (done) return;
    spin.value = 0;
    spin.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1);
    return () => cancelAnimation(spin);
  }, [done, spin]);

  // 분석 중(0) ↔ 완료(1). 첫 렌더는 현재 톤에서 바로 시작한다.
  const tone = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    tone.value = withTiming(done ? 1 : 0, { duration: TONE_DURATION, easing: Easing.out(Easing.cubic) });
  }, [done, tone]);

  // 누르면 살짝 눌리고(0.96), 떼면 원래 크기로. 알파 대신 크기로 눌림을 표현한다.
  const pressScale = useSharedValue(1);
  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(PRESSED_SCALE, { damping: 30, stiffness: 600 });
  }, [pressScale]);
  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, { damping: 46, stiffness: 600 });
  }, [pressScale]);

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tone.value, [0, 1], [Colors.primary, Colors.background]),
    shadowColor: interpolateColor(tone.value, [0, 1], [Colors.primary, '#000000']),
    shadowOpacity: interpolate(tone.value, [0, 1], [0.35, 0.12]),
    transform: [{ scale: pressScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    color: interpolateColor(tone.value, [0, 1], ['#FFFFFF', Colors.textPrimary]),
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    color: interpolateColor(tone.value, [0, 1], ['#FFFFFFCC', Colors.primary]),
  }));
  const loaderStyle = useAnimatedStyle(() => ({
    opacity: 1 - tone.value,
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: tone.value }));

  const artsWidth = state.arts.length > 1 ? ART_SIZE + ART_OVERLAP_OFFSET : ART_SIZE;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      layout={relayout}
      style={[styles.pill, pillStyle]}
    >
      <Animated.View layout={relayout} style={[styles.arts, { width: artsWidth }]}>
        {state.arts.map((url, index) => (
          <Animated.View
            key={index}
            layout={relayout}
            entering={FadeIn.duration(TEXT_FADE_DURATION)}
            exiting={FadeOut.duration(TEXT_FADE_DURATION)}
            style={[styles.artSlot, { left: index * ART_OVERLAP_OFFSET, zIndex: state.arts.length - index }]}
          >
            <ArtworkImage url={url} size={ART_SIZE} cornerRadius={ART_SIZE / 2} />
          </Animated.View>
        ))}
      </Animated.View>
      <Animated.View layout={relayout} style={styles.textBlock}>
        <Animated.Text
          key={state.title}
          entering={FadeIn.duration(TEXT_FADE_DURATION)}
          style={[styles.title, titleStyle]}
          numberOfLines={1}
        >
          {state.title}
        </Animated.Text>
        <Animated.Text
          key={state.subtitle}
          entering={FadeIn.duration(TEXT_FADE_DURATION)}
          style={[styles.subtitle, subtitleStyle]}
          numberOfLines={1}
        >
          {state.subtitle}
        </Animated.Text>
      </Animated.View>
      <Animated.View layout={relayout} style={styles.iconSlot}>
        <Animated.View style={[styles.icon, loaderStyle]}>
          <Feather name="loader" size={20} color="#FFFFFF" />
        </Animated.View>
        <Animated.View style={[styles.icon, checkStyle]}>
          <Feather name="check-circle" size={20} color={Colors.primary} />
        </Animated.View>
      </Animated.View>
    </AnimatedPressable>
  );
}

export default React.memo(AnalysisPill);

const styles = StyleSheet.create({
  pill: {
    height: PILL_HEIGHT,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 20,
    borderRadius: PILL_HEIGHT / 2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 8,
  },
  arts: {
    height: ART_SIZE,
  },
  artSlot: {
    position: 'absolute',
    top: 0,
    width: ART_SIZE,
    height: ART_SIZE,
  },
  textBlock: {
    flexShrink: 1,
    gap: 3,
  },
  title: {
    ...Typography.bodyBold,
    fontSize: 14,
    lineHeight: 17,
  },
  subtitle: {
    ...Typography.bodyMedium,
    fontSize: 11.5,
    lineHeight: 14,
  },
  iconSlot: {
    width: 20,
    height: 20,
  },
  icon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
