import React, { useCallback, useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { RootStackParamList } from '../navigation/AppNavigator';
import SongCardShowcase from '../components/rewardCards/SongCardShowcase';
import LevelPips from '../components/rewardCards/LevelPips';
import { CARD_RATIO, LEVEL_MATERIAL, SHOWROOM, useMinchoFamily } from '../components/rewardCards/cardTheme';
import { WEAR_LABEL, wearState } from '../components/rewardCards/cardWear';
import { findDummySongCard } from '../components/rewardCards/dummyRewardCards';
import { useCardTilt } from '../components/rewardCards/useCardTilt';

type Props = NativeStackScreenProps<RootStackParamList, 'RewardCardDetail'>;

const WEAR_TONE = {
  fresh: { bg: '#FFFFFF14', fg: SHOWROOM.fg },
  faded: { bg: '#3A2F1C', fg: '#F2C98A' },
  worn: { bg: '#3E231E', fg: '#F3A594' },
  tattered: { bg: '#3E231E', fg: '#F3A594' },
} as const;

export default function RewardCardDetailScreen({ navigation, route }: Props) {
  const card = findDummySongCard(route.params.cardId);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const mincho = useMinchoFamily();
  const tilt = useCardTilt();

  const enter = useSharedValue(0);
  const info = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, { damping: 14, stiffness: 110, mass: 0.9 });
    info.value = withDelay(220, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
  }, [enter, info]);

  const cardIn = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.6),
    transform: [{ translateY: (1 - enter.value) * 40 }, { scale: 0.86 + enter.value * 0.14 }],
  }));
  const infoIn = useAnimatedStyle(() => ({
    opacity: info.value,
    transform: [{ translateY: (1 - info.value) * 12 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: enter.value * 0.9,
    transform: [{ translateX: tilt.x.value * 14 }, { translateY: tilt.y.value * 10 }],
  }));

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);
  const handleFlip = useCallback(() => {
    tilt.flip.value = withTiming(tilt.flip.value > 0.5 ? 0 : 1, { duration: 720 });
  }, [tilt.flip]);
  const handleReview = useCallback(() => {
    if (card?.songId != null) navigation.navigate('SongDetail', { songId: card.songId, origin: 'reward_card' });
  }, [card, navigation]);

  if (!card) {
    return <View style={styles.root} />;
  }

  const cardW = Math.min(screenW * 0.74, (screenH * 0.52) / CARD_RATIO, 340);
  const material = LEVEL_MATERIAL[card.level];
  const wear = wearState(card.recall);
  const tone = WEAR_TONE[wear];
  const goal = card.nextGoal;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image source={{ uri: card.artworkUrl }} style={[StyleSheet.absoluteFill, styles.backdrop]} blurRadius={40} />
      <LinearGradient
        colors={[`${SHOWROOM.bg}99`, `${SHOWROOM.bg}D9`, SHOWROOM.bg]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={handleClose} hitSlop={10} style={styles.iconBtn}>
            <Feather name="chevron-down" size={22} color={SHOWROOM.fg} />
          </Pressable>
          <Pressable onPress={handleFlip} hitSlop={10} style={styles.iconBtn}>
            <Feather name="refresh-ccw" size={18} color={SHOWROOM.fg} />
          </Pressable>
        </View>

        <View style={styles.stage}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              { width: cardW * 0.9, height: cardW * 0.9 * CARD_RATIO, boxShadow: `0 0 120px 30px ${card.accent}8C` },
              glowStyle,
            ]}
          />
          <GestureDetector gesture={tilt.gesture}>
            <Animated.View style={cardIn}>
              <SongCardShowcase card={card} width={cardW} tilt={tilt} mincho={mincho} />
            </Animated.View>
          </GestureDetector>
        </View>

        <Animated.View style={[styles.info, infoIn]}>
          <Text style={[styles.title, { fontFamily: mincho.extraBold }]} numberOfLines={1}>{card.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{card.artist}</Text>

          <View style={styles.chips}>
            <LinearGradient colors={material.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.levelChip}>
              <LevelPips level={card.level} color={material.chipText} size={5} />
              <Text style={[styles.levelText, { color: material.chipText }]}>{material.tier}</Text>
            </LinearGradient>
            {card.lenticular && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>렌티큘러</Text>
              </View>
            )}
            <View style={[styles.chip, { backgroundColor: tone.bg }]}>
              <Text style={[styles.chipText, { color: tone.fg }]}>
                {WEAR_LABEL[wear]} · 기억 {Math.round(card.recall * 100)}%
              </Text>
            </View>
          </View>

          {goal && (
            <View style={styles.goal}>
              <View style={styles.goalHead}>
                <Text style={styles.goalLabel}>{goal.label}</Text>
                <Text style={styles.goalValue}>
                  {goal.current}
                  <Text style={styles.goalTotal}> / {goal.total}</Text>
                </Text>
              </View>
              <View style={styles.goalTrack}>
                <View style={[styles.goalFill, { width: `${(goal.current / goal.total) * 100}%`, backgroundColor: card.accent }]} />
              </View>
            </View>
          )}

          {wear !== 'fresh' && (
            <Pressable onPress={handleReview} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
              <Text style={styles.ctaText}>복습하고 카드 되살리기</Text>
            </Pressable>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHOWROOM.bg },
  backdrop: { opacity: 0.55, transform: [{ scale: 1.3 }] },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SHOWROOM.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', borderRadius: 40 },
  info: { paddingHorizontal: 24, paddingBottom: 16, gap: 6 },
  title: { color: SHOWROOM.fg, fontSize: 26, lineHeight: 34, textAlign: 'center' },
  artist: { color: SHOWROOM.fgDim, fontSize: 14, textAlign: 'center' },
  chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  levelText: { fontSize: 12, fontWeight: '700' },
  chip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: SHOWROOM.glass },
  chipText: { color: SHOWROOM.fg, fontSize: 12, fontWeight: '600' },
  goal: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: SHOWROOM.glass,
    gap: 10,
  },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  goalLabel: { color: SHOWROOM.fgDim, fontSize: 13, fontWeight: '500' },
  goalValue: { color: SHOWROOM.fg, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  goalTotal: { color: SHOWROOM.fgDim, fontSize: 13, fontWeight: '500' },
  goalTrack: { height: 6, borderRadius: 999, backgroundColor: '#FFFFFF1F', overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 999 },
  cta: {
    marginTop: 12,
    height: 52,
    borderRadius: 16,
    backgroundColor: SHOWROOM.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: SHOWROOM.bg, fontSize: 16, fontWeight: '700' },
});
