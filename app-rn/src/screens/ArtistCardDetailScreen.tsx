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
import ArtistCardShowcase from '../components/rewardCards/ArtistCardShowcase';
import { artistGradeStep, nextArtistGradeStep } from '../components/rewardCards/artistGrade';
import { ARTIST_CARD_RATIO, ARTIST_MATERIAL, SHOWROOM, useCardFonts } from '../components/rewardCards/cardTheme';
import { useCardTilt } from '../components/rewardCards/useCardTilt';
import { useRewardCardStore } from '../stores/rewardCardStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ArtistCardDetail'>;

export default function ArtistCardDetailScreen({ navigation, route }: Props) {
  const card = useRewardCardStore((s) => s.artistCards.find((c) => c.id === route.params.cardId));
  const { width: screenW } = useWindowDimensions();
  const fonts = useCardFonts();
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

  if (!card) {
    return <View style={styles.root} />;
  }

  const cardW = Math.min(screenW - 40, 400);
  const step = artistGradeStep(card.masteredCount);
  const next = nextArtistGradeStep(card.masteredCount);
  const material = ARTIST_MATERIAL[step.grade];

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image source={{ uri: card.imageUrl }} style={[StyleSheet.absoluteFill, styles.backdrop]} blurRadius={40} />
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
              { width: cardW * 0.9, height: cardW * 0.9 * ARTIST_CARD_RATIO, boxShadow: `0 0 120px 30px ${card.accent}8C` },
              glowStyle,
            ]}
          />
          <GestureDetector gesture={tilt.gesture}>
            <Animated.View style={cardIn}>
              <ArtistCardShowcase card={card} width={cardW} tilt={tilt} fonts={fonts} ownerName={route.params.ownerName} />
            </Animated.View>
          </GestureDetector>
        </View>

        <Animated.View style={[styles.info, infoIn]}>
          <View style={styles.chips}>
            <LinearGradient colors={material.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradeChip}>
              <Text style={[styles.gradeText, { color: material.chipText }]}>{step.label}</Text>
            </LinearGradient>
            <View style={styles.chip}>
              <Text style={styles.chipText}>마스터 {card.masteredCount}곡</Text>
            </View>
          </View>

          {next && (
            <View style={styles.goal}>
              <View style={styles.goalHead}>
                <Text style={styles.goalLabel}>{next.label}까지</Text>
                <Text style={styles.goalValue}>
                  {card.masteredCount}
                  <Text style={styles.goalTotal}> / {next.from}곡</Text>
                </Text>
              </View>
              <View style={styles.goalTrack}>
                <View
                  style={[
                    styles.goalFill,
                    {
                      width: `${((card.masteredCount - step.from) / (next.from - step.from)) * 100}%`,
                      backgroundColor: card.accent,
                    },
                  ]}
                />
              </View>
            </View>
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
  chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 },
  gradeChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  gradeText: { fontSize: 12, fontWeight: '700' },
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
});
