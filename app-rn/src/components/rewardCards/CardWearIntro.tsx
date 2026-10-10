import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import SongCardShowcase from './SongCardShowcase';
import { CardFonts, SHOWROOM } from './cardTheme';
import { FRESH_RECALL } from './cardWear';
import { SongRewardCard } from './types';
import { useCardTilt } from './useCardTilt';

// 왼쪽 끝은 새 카드, 오른쪽 끝은 다 낡은 카드(cardWear 의 age 1).
const RECALL_MAX = 0.95;
const RECALL_MIN = 0.5;
const SWEEP_DELAY_MS = 500;
const SWEEP_MS = 3200;
const THUMB = 22;

function recallAt(pos: number): number {
  'worklet';
  return RECALL_MAX - pos * (RECALL_MAX - RECALL_MIN);
}

const FRESH_POS = (RECALL_MAX - FRESH_RECALL) / (RECALL_MAX - RECALL_MIN);

interface Props {
  card: SongRewardCard;
  fonts: CardFonts;
  previewWidth: number;
  accent: string;
  bottomInset: number;
  onDone: () => void;
}

/** 첫 곡 카드를 받은 뒤 한 번 — 기억할 확률을 내리며 같은 카드가 낡아 가는 모습을 보여 준다. */
function CardWearIntro({ card, fonts, previewWidth, accent, bottomInset, onDone }: Props) {
  const tilt = useCardTilt();
  const pos = useSharedValue(0);
  const trackW = useSharedValue(0);
  // 카드는 1% 단위로만 다시 그린다 — 매 프레임 그리기엔 무겁다.
  const [percent, setPercent] = useState(Math.round(RECALL_MAX * 100));

  useEffect(() => {
    pos.value = withDelay(SWEEP_DELAY_MS, withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }));
  }, [pos]);

  useAnimatedReaction(
    () => Math.round(recallAt(pos.value) * 100),
    (next, prev) => {
      if (next !== prev) runOnJS(setPercent)(next);
    },
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          cancelAnimation(pos);
          if (trackW.value > 0) pos.value = Math.min(1, Math.max(0, e.x / trackW.value));
        })
        .onUpdate((e) => {
          if (trackW.value > 0) pos.value = Math.min(1, Math.max(0, e.x / trackW.value));
        }),
    [pos, trackW],
  );

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    trackW.value = e.nativeEvent.layout.width;
  };

  const fillStyle = useAnimatedStyle(() => ({ width: pos.value * trackW.value }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value * trackW.value - THUMB / 2 }] }));

  const preview = useMemo(() => ({ ...card, recall: percent / 100 }), [card, percent]);

  return (
    <View style={[styles.root, { paddingBottom: bottomInset + 16 }]}>
      <Text style={styles.title}>카드가 낡지 않게 자주 복습해주세요</Text>

      <View style={styles.stage}>
        <GestureDetector gesture={tilt.gesture}>
          <View>
            <SongCardShowcase card={preview} width={previewWidth} tilt={tilt} fonts={fonts} />
          </View>
        </GestureDetector>
      </View>

      <Text style={styles.value}>
        기억할 확률 <Text style={{ color: accent }}>{percent}%</Text>
      </Text>
      <GestureDetector gesture={gesture}>
        <View style={styles.hit}>
          <View style={styles.track} onLayout={handleTrackLayout}>
            <Animated.View style={[styles.fill, { backgroundColor: accent }, fillStyle]} />
            <View style={[styles.tick, { left: `${FRESH_POS * 100}%` }]} />
            <Animated.View style={[styles.thumb, thumbStyle]} />
          </View>
        </View>
      </GestureDetector>

      <Text style={styles.rule}>
        <Text style={styles.ruleStrong}>기억할 확률</Text>: 이 곡에서 공부한 단어를 지금 떠올릴 수 있는 확률의 평균{'\n'}
        시간이 지나면 떨어지고, 복습하면 다시 올라가요.{'\n'}
        90% 아래로 떨어지면 카드가 낡기 시작해요.
      </Text>

      <Pressable onPress={onDone} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
        <Text style={styles.ctaText}>알겠어요</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  title: { color: SHOWROOM.fg, fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  value: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  hit: { height: 40, justifyContent: 'center', paddingHorizontal: THUMB / 2 },
  track: { height: 4, borderRadius: 2, backgroundColor: SHOWROOM.line },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  tick: { position: 'absolute', top: -4, width: 2, height: 12, marginLeft: -1, borderRadius: 1, backgroundColor: SHOWROOM.fgDim },
  thumb: {
    position: 'absolute',
    top: (4 - THUMB) / 2,
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: SHOWROOM.fg,
  },
  rule: { color: SHOWROOM.fgDim, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  ruleStrong: { color: SHOWROOM.fg, fontWeight: '700' },
  cta: {
    height: 52,
    borderRadius: 16,
    backgroundColor: SHOWROOM.fg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  ctaText: { color: SHOWROOM.bg, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});

export default React.memo(CardWearIntro);
