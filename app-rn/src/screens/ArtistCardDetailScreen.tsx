import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import CardShareButton from '../components/rewardCards/CardShareButton';
import GradePanel, { GradeTab } from '../components/rewardCards/GradePanel';
import { useShallow } from 'zustand/react/shallow';
import { ARTIST_GRADE_STEPS } from '../components/rewardCards/artistGrade';
import type { CardGoal } from '../components/rewardCards/types';
import { artistCardOfStep, artistCardSample, artistCardsOf, artistRung } from '../components/rewardCards/cardKinds';
import { serverTargetId } from '../components/rewardCards/serverRewardCards';
import { ARTIST_CARD_RATIO, ARTIST_MATERIAL, SHOWROOM, useCardFonts } from '../components/rewardCards/cardTheme';
import { useCardTilt } from '../components/rewardCards/useCardTilt';
import { useRewardCardStore } from '../stores/rewardCardStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ArtistCardDetail'>;

const ARTIST_TABS: readonly GradeTab[] = ARTIST_GRADE_STEPS.map((step) => ({
  key: step.grade,
  label: step.label,
  frame: ARTIST_MATERIAL[step.grade].frame,
  ink: ARTIST_MATERIAL[step.grade].chipText,
}));

function artistCondition(rung: number): string {
  const from = ARTIST_GRADE_STEPS[rung].from;
  return from === 0 ? '이 아티스트의 첫 곡 카드 얻기' : `이 아티스트 곡의 MASTER 카드 ${from}장 모으기`;
}

export default function ArtistCardDetailScreen({ navigation, route }: Props) {
  const { cardId } = route.params;
  const opened = useRewardCardStore((s) => s.artistCards.find((c) => c.id === cardId));
  // 등급마다 카드가 따로라, 다른 칸을 누르면 그 등급의 내 카드로 바꿔 보여 준다.
  const siblings = useRewardCardStore(
    useShallow((s) => (opened ? artistCardsOf(s.artistCards, opened.artistId, opened.name) : [])),
  );
  const top = useMemo(
    () => siblings.reduce<typeof opened>((best, c) => (best == null || c.masteredCount > best.masteredCount ? c : best), opened),
    [siblings, opened],
  );
  const ownedRung = top ? artistRung(top) : 0;
  const goals = useMemo(() => {
    const byRung: Partial<Record<number, CardGoal>> = {};
    if (top == null) return byRung;
    for (let rung = ownedRung + 1; rung < ARTIST_GRADE_STEPS.length; rung++) {
      byRung[rung] = { current: top.masteredCount, total: ARTIST_GRADE_STEPS[rung].from };
    }
    return byRung;
  }, [top, ownedRung]);
  const [pickedRung, setPickedRung] = useState<number | null>(null);
  const viewRung = pickedRung ?? (opened ? artistRung(opened) : 0);
  const owned = pickedRung == null ? opened : artistCardOfStep(siblings, ARTIST_GRADE_STEPS[viewRung]) ?? undefined;
  const card = useMemo(
    () => owned ?? (opened ? artistCardSample(opened, ARTIST_GRADE_STEPS[viewRung]) : undefined),
    [owned, opened, viewRung],
  );
  const handleSelectRung = useCallback((rung: number) => setPickedRung(rung), []);
  const { width: screenW } = useWindowDimensions();
  const fonts = useCardFonts();
  const tilt = useCardTilt();
  const cardRef = useRef<View>(null);

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
  const artistId = card?.artistId ?? null;
  const shareId = owned?.issued === true ? serverTargetId(owned.id) : null;
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
            {shareId != null && <CardShareButton kind="artist" cardId={shareId} title={card.name} tilt={tilt} cardRef={cardRef} accent={card.accent} ink={card.ink} />}
          </View>
        </View>

        <View style={styles.stage}>
          <GestureDetector gesture={tilt.gesture}>
            <Animated.View style={cardIn}>
              <View ref={cardRef} collapsable={false}>
                <ArtistCardShowcase card={card} width={cardW} tilt={tilt} fonts={fonts} ownerName={route.params.ownerName} />
              </View>
            </Animated.View>
          </GestureDetector>
        </View>

        <Animated.View style={[styles.info, infoIn]}>
          <GradePanel
            tabs={ARTIST_TABS}
            owned={ownedRung}
            selected={viewRung}
            goals={goals}
            condition={artistCondition}
            onSelect={handleSelectRung}
          />
          <Pressable
            onPress={handleOpenArtist}
            disabled={artistId == null}
            style={({ pressed }) => [styles.subCta, artistId == null && styles.linkDisabled, pressed && styles.linkPressed]}
          >
            <Text style={styles.subCtaText} numberOfLines={1}>
              아티스트 보기
            </Text>
          </Pressable>
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
  info: { paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
  subCta: { height: 44, borderRadius: 14, backgroundColor: SHOWROOM.glass, alignItems: 'center', justifyContent: 'center' },
  subCtaText: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '600' },
  linkDisabled: { opacity: 0.4 },
  linkPressed: { opacity: 0.85 },
});
