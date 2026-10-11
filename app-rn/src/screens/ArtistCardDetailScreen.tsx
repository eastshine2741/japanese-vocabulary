import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import GradeTabs, { GradeTab } from '../components/rewardCards/GradeTabs';
import { ARTIST_GRADE_STEPS, artistGradeStep, nextArtistGradeStep } from '../components/rewardCards/artistGrade';
import { artistCardAt } from '../components/rewardCards/cardKinds';
import { artistRung } from '../components/rewardCards/cardUpgrade';
import { ArtistRewardCard } from '../components/rewardCards/types';
import { ARTIST_CARD_RATIO, ARTIST_MATERIAL, SHOWROOM, useCardFonts } from '../components/rewardCards/cardTheme';
import { useCardTilt } from '../components/rewardCards/useCardTilt';
import { useRewardCardStore } from '../stores/rewardCardStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ArtistCardDetail'>;

const ARTIST_TABS: readonly GradeTab[] = ARTIST_GRADE_STEPS.map((step) => ({
  key: step.grade,
  label: step.label,
  frame: ARTIST_MATERIAL[step.grade].frame,
  chipText: ARTIST_MATERIAL[step.grade].chipText,
}));

function artistCondition(rung: number): string {
  const from = ARTIST_GRADE_STEPS[rung].from;
  return from === 0 ? '이 아티스트의 첫 곡 카드 얻기' : `이 아티스트 곡의 MASTER 카드 ${from}장 모으기`;
}

/** 내 카드를 그 재질로 돌린다. 아직 얻지 않은 재질은 주인 정보를 비운 견본이다. */
function artistCardAtRung(card: ArtistRewardCard, rung: number): ArtistRewardCard {
  const step = ARTIST_GRADE_STEPS[rung];
  if (rung <= artistRung(card)) return artistCardAt(card, step);
  return { ...card, masteredCount: step.from, sample: true };
}

export default function ArtistCardDetailScreen({ navigation, route }: Props) {
  const { cardId, masteredCount } = route.params;
  const owned = useRewardCardStore((s) => s.artistCards.find((c) => c.id === cardId));
  const ownedRung = owned ? artistRung(owned) : 0;
  const [pickedRung, setPickedRung] = useState<number | null>(() =>
    masteredCount != null ? ARTIST_GRADE_STEPS.indexOf(artistGradeStep(masteredCount)) : null,
  );
  const viewRung = pickedRung ?? ownedRung;
  const card = useMemo(() => (owned ? artistCardAtRung(owned, viewRung) : owned), [owned, viewRung]);
  // 다른 재질을 볼 때는 지금 카드의 승급 조건이 맞지 않는다.
  const isOtherGrade = card !== owned;
  const handleSelectRung = useCallback((rung: number) => setPickedRung(rung), []);
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

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);
  const handleFlip = useCallback(() => {
    tilt.flip.value = withTiming(tilt.flip.value > 0.5 ? 0 : 1, { duration: 720 });
  }, [tilt.flip]);
  const artistId = card?.artistId ?? null;
  const handleOpenArtist = useCallback(() => {
    if (artistId != null) navigation.navigate('ArtistDetail', { artistId });
  }, [artistId, navigation]);

  // 다시 받은 카드 목록에 이 카드가 없으면 닫을 길만 남긴다.
  if (!card) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <Pressable onPress={handleClose} hitSlop={10} style={styles.iconBtn}>
              <Feather name="chevron-down" size={22} color={SHOWROOM.fg} />
            </Pressable>
          </View>
          <View style={styles.missing}>
            <Text style={styles.missingText}>카드를 찾을 수 없어요</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const cardW = Math.min(screenW - 40, 400);
  const next = nextArtistGradeStep(card.masteredCount);

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
          <View style={styles.actions}>
            <Pressable onPress={handleFlip} hitSlop={10} style={styles.iconBtn}>
              <Feather name="refresh-ccw" size={18} color={SHOWROOM.fg} />
            </Pressable>
          </View>
        </View>

        <View style={styles.stage}>
          <GestureDetector gesture={tilt.gesture}>
            <Animated.View style={cardIn}>
              <ArtistCardShowcase card={card} width={cardW} tilt={tilt} fonts={fonts} ownerName={route.params.ownerName} />
            </Animated.View>
          </GestureDetector>
        </View>

        <Animated.View style={[styles.info, infoIn]}>
          <GradeTabs tabs={ARTIST_TABS} selected={viewRung} owned={ownedRung} onSelect={handleSelectRung} />
          <View style={styles.chips}>
            <Pressable
              onPress={handleOpenArtist}
              disabled={artistId == null}
              hitSlop={6}
              style={({ pressed }) => [styles.linkChip, artistId == null && styles.linkDisabled, pressed && styles.linkPressed]}
            >
              <Text style={styles.linkText} numberOfLines={1}>
                {card.name}
              </Text>
              <Feather name="chevron-right" size={13} color={SHOWROOM.fg} />
            </Pressable>
          </View>

          {isOtherGrade ? (
            <View style={styles.goal}>
              <Text style={styles.goalCaption}>{ARTIST_TABS[viewRung].label} 획득 조건</Text>
              <View style={styles.goalHead}>
                <Text style={styles.goalLabel}>{artistCondition(viewRung)}</Text>
                {viewRung < ownedRung && <Feather name="check" size={16} color={SHOWROOM.fg} />}
              </View>
            </View>
          ) : next && (
            <View style={styles.goal}>
              <Text style={styles.goalCaption}>{next.label} 승급 조건</Text>
              <View style={styles.goalHead}>
                <Text style={styles.goalLabel}>이 아티스트 곡의 MASTER 카드 {next.from}장 모으기</Text>
                <Text style={styles.goalValue}>
                  {card.masteredCount}
                  <Text style={styles.goalTotal}> / {next.from}</Text>
                </Text>
              </View>
              <View style={styles.goalTrack}>
                <View
                  style={[styles.goalFill, { width: `${(card.masteredCount / next.from) * 100}%`, backgroundColor: card.accent }]}
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
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { fontSize: 14, color: SHOWROOM.fgDim },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  actions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SHOWROOM.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  info: { paddingHorizontal: 24, paddingBottom: 16, gap: 6 },
  chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    maxWidth: 200,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 5,
    backgroundColor: SHOWROOM.glass,
  },
  linkText: { flexShrink: 1, color: SHOWROOM.fg, fontSize: 12, fontWeight: '600' },
  linkDisabled: { opacity: 0.4 },
  linkPressed: { opacity: 0.85 },
  goal: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: SHOWROOM.glass,
    gap: 8,
  },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  goalCaption: { color: SHOWROOM.fgDim, fontSize: 12, fontWeight: '500' },
  goalLabel: { flex: 1, color: SHOWROOM.fg, fontSize: 14, fontWeight: '600' },
  goalValue: { color: SHOWROOM.fg, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  goalTotal: { color: SHOWROOM.fgDim, fontSize: 13, fontWeight: '500' },
  goalTrack: { height: 6, borderRadius: 999, backgroundColor: '#FFFFFF1F', overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 999 },
});
