import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { deckApi } from '../api/deckApi';
import SongCardShowcase from '../components/rewardCards/SongCardShowcase';
import LevelPips from '../components/rewardCards/LevelPips';
import {
  CARD_RATIO,
  LEVEL_MATERIAL,
  MASTER_CHIP,
  SHOWROOM,
  SONG_MASTER_NAME,
  SONG_TIER_NAME,
  songTierName,
  useCardFonts,
} from '../components/rewardCards/cardTheme';
import { useCardTilt } from '../components/rewardCards/useCardTilt';
import { songCardAt } from '../components/rewardCards/cardKinds';
import { useRewardCardStore } from '../stores/rewardCardStore';
import { SongRewardCard } from '../components/rewardCards/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RewardCardDetail'>;

interface Box {
  y: number;
  width: number;
  height: number;
}

// 기울이면 원근 때문에 카드가 테 밖으로 조금 나온다.
const STAGE_INSET = 16;
const FOCUS_INSET = 24;


/** 다음 등급과 거기에 오르는 조건. 기본은 첫 학습, 레벨 n 은 n번째 단계(후렴 정복 → 따라 부르기 → 완곡) 단어를 다 공부한 카드다. */
function nextLevel(card: SongRewardCard): { name: string; condition: string } {
  if (card.level === 0) return { name: SONG_TIER_NAME[1], condition: "'후렴 정복' 단계 단어 모두 공부하기" };
  if (card.level === 1) return { name: SONG_TIER_NAME[2], condition: "'따라 부르기' 단계 단어 모두 공부하기" };
  if (card.level === 2) return { name: SONG_TIER_NAME[3], condition: "'완곡' 단계 단어 모두 공부하기" };
  return { name: SONG_MASTER_NAME, condition: '곡 단어의 90%를 장기 기억으로 만들기' };
}

export default function RewardCardDetailScreen({ navigation, route }: Props) {
  const { cardId, grade } = route.params;
  const owned = useRewardCardStore((s) => s.songCards.find((c) => c.id === cardId));
  const card = useMemo(() => (owned && grade ? songCardAt(owned, grade) : owned), [owned, grade]);
  // 지나온 등급을 볼 때는 지금 카드의 승급 조건이 맞지 않는다.
  const isPastGrade = card !== owned;
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
  const infoIn = useAnimatedStyle(() => ({ opacity: info.value, transform: [{ translateY: (1 - info.value) * 12 }] }));
  const [body, setBody] = useState<Box | null>(null);
  const [stage, setStage] = useState<Box | null>(null);
  const handleBodyLayout = useCallback((e: LayoutChangeEvent) => setBody(e.nativeEvent.layout), []);
  const handleStageLayout = useCallback((e: LayoutChangeEvent) => setStage(e.nativeEvent.layout), []);

  const cardW = stage == null ? 0 : Math.min(screenW * 0.74, 340, Math.max(0, stage.height - STAGE_INSET * 2) / CARD_RATIO);
  // 카드만 보기는 레이아웃을 그대로 두고 카드를 키워 화면 가운데로 옮긴다 — 다시 재면 카드가 튄다.
  const focusScale =
    body == null || cardW === 0
      ? 1
      : Math.min((body.width - FOCUS_INSET * 2) / cardW, (body.height - FOCUS_INSET * 2) / (cardW * CARD_RATIO));
  const focusShift = body == null || stage == null ? 0 : body.height / 2 - (stage.y + stage.height / 2);

  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  useEffect(() => {
    focus.value = withTiming(focused ? 1 : 0, { duration: 360, easing: Easing.out(Easing.cubic) });
  }, [focus, focused]);
  const handleFocus = useCallback(() => setFocused(true), []);
  const handleUnfocus = useCallback(() => setFocused(false), []);
  // 뒤로 가기·내려 닫기는 화면을 닫기 전에 카드만 보기부터 푼다.
  useEffect(() => {
    if (!focused) return;
    return navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      setFocused(false);
    });
  }, [focused, navigation]);

  const chromeStyle = useAnimatedStyle(() => ({ opacity: 1 - focus.value }));
  const focusStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: focusShift * focus.value }, { scale: 1 + (focusScale - 1) * focus.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: enter.value * 0.9,
    transform: [{ translateX: tilt.x.value * 14 }, { translateY: tilt.y.value * 10 }],
  }));

  const handleClose = useCallback(() => navigation.goBack(), [navigation]);
  const handleFlip = useCallback(() => {
    tilt.flip.value = withTiming(tilt.flip.value > 0.5 ? 0 : 1, { duration: 720 });
  }, [tilt.flip]);
  const handleDebugWearIntro = useCallback(() => {
    navigation.navigate('RewardCardReveal', { kind: 'song', cardId, debugWearIntro: true });
  }, [navigation, cardId]);
  const handleEditLyric = useCallback(() => {
    navigation.navigate('RewardCardLyricEdit', { cardId });
  }, [navigation, cardId]);

  const songId = card?.songId ?? null;
  const handleOpenSong = useCallback(() => {
    if (songId != null) navigation.navigate('SongDetail', { songId, origin: 'reward_card_detail' });
  }, [navigation, songId]);
  const [isStartingReview, setIsStartingReview] = useState(false);
  const handleStartReview = useCallback(async () => {
    if (songId == null || isStartingReview) return;
    setIsStartingReview(true);
    try {
      const deck = await deckApi.getDeckBySongId(songId);
      if (deck?.deckId == null) return;
      navigation.navigate('SongReview', {
        trigger: 'reward_card',
        source: {
          deckId: deck.deckId,
          songId,
          title: deck.title ?? card?.title ?? '',
          artist: deck.artist ?? card?.artist ?? '',
          artworkUrl: deck.artworkUrl ?? card?.artworkUrl ?? null,
          dueCount: deck.dueCount,
          totalCount: deck.wordCount,
        },
      });
    } catch {
      // 덱을 못 찾으면 버튼만 다시 누를 수 있게 둔다.
    } finally {
      setIsStartingReview(false);
    }
  }, [card, isStartingReview, navigation, songId]);

  if (!card) {
    return <View style={styles.root} />;
  }

  const material = card.mastered ? MASTER_CHIP : LEVEL_MATERIAL[card.level];
  const goal = card.nextGoal;
  const next = nextLevel(card);

  return (
    <View style={styles.root}>
      <StatusBar style="light" hidden={focused} />
      <Image source={{ uri: card.artworkUrl }} style={[StyleSheet.absoluteFill, styles.backdrop]} blurRadius={40} />
      <LinearGradient
        colors={[`${SHOWROOM.bg}99`, `${SHOWROOM.bg}D9`, SHOWROOM.bg]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.safe} onLayout={handleBodyLayout}>
          <Pressable style={StyleSheet.absoluteFill} disabled={!focused} onPress={handleUnfocus} />
          <Animated.View style={[styles.topBar, chromeStyle]} pointerEvents={focused ? 'none' : 'auto'}>
            <Pressable onPress={handleClose} hitSlop={10} style={styles.iconBtn}>
              <Feather name="chevron-down" size={22} color={SHOWROOM.fg} />
            </Pressable>
            <View style={styles.actions}>
              <Pressable onPress={handleFocus} hitSlop={10} style={styles.iconBtn}>
                <Feather name="maximize-2" size={17} color={SHOWROOM.fg} />
              </Pressable>
              <Pressable onPress={handleEditLyric} hitSlop={10} style={styles.iconBtn}>
                <Feather name="edit-3" size={18} color={SHOWROOM.fg} />
              </Pressable>
              <Pressable onPress={handleFlip} hitSlop={10} style={styles.iconBtn}>
                <Feather name="refresh-ccw" size={18} color={SHOWROOM.fg} />
              </Pressable>
            </View>
          </Animated.View>

          <View style={styles.stage} pointerEvents="box-none" onLayout={handleStageLayout}>
            {cardW > 0 && (
              <Animated.View style={[styles.stageCenter, focusStyle]} pointerEvents="box-none">
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
                    <SongCardShowcase card={card} width={cardW} tilt={tilt} fonts={fonts} ownerName={route.params.ownerName} />
                  </Animated.View>
                </GestureDetector>
              </Animated.View>
            )}
          </View>

          <Animated.View style={chromeStyle} pointerEvents={focused ? 'none' : 'auto'}>
            <Animated.View style={[styles.info, infoIn]}>
              <View style={styles.chips}>
                <LinearGradient colors={material.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.levelChip}>
                  <LevelPips level={card.level} color={material.chipText} size={5} />
                  <Text style={[styles.levelText, { color: material.chipText }]}>{songTierName(card.level, card.mastered)}</Text>
                </LinearGradient>
                <Pressable
                  onPress={handleOpenSong}
                  disabled={songId == null}
                  hitSlop={6}
                  style={({ pressed }) => [styles.linkChip, songId == null && styles.ctaDisabled, pressed && styles.ctaPressed]}
                >
                  <Text style={styles.linkText} numberOfLines={1}>
                    {card.title}
                  </Text>
                  <Feather name="chevron-right" size={13} color={SHOWROOM.fg} />
                </Pressable>
              </View>

              <View style={styles.panel}>
                <Pressable style={styles.panelHead} onLongPress={__DEV__ ? handleDebugWearIntro : undefined}>
                  <Text style={styles.panelTitle}>기억할 확률</Text>
                  <Text style={styles.panelValue}>{Math.round(card.recall * 100)}%</Text>
                </Pressable>
                <Text style={styles.panelNote}>이 곡에서 공부한 단어를 지금 떠올릴 수 있는 확률의 평균이에요.</Text>

                {goal && !isPastGrade && (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.panelCaption}>{next.name} 승급 조건</Text>
                    <View style={styles.panelHead}>
                      <Text style={styles.panelTitle}>{next.condition}</Text>
                      <Text style={styles.panelValue}>
                        {goal.current}
                        <Text style={styles.panelTotal}> / {goal.total}</Text>
                      </Text>
                    </View>
                    <View style={styles.goalTrack}>
                      <View style={[styles.goalFill, { width: `${(goal.current / goal.total) * 100}%`, backgroundColor: card.accent }]} />
                    </View>
                  </>
                )}
              </View>

              <Pressable
                onPress={handleStartReview}
                disabled={songId == null || isStartingReview}
                style={({ pressed }) => [styles.cta, songId == null && styles.ctaDisabled, pressed && styles.ctaPressed]}
              >
                {isStartingReview ? <ActivityIndicator color={SHOWROOM.bg} /> : <Text style={styles.ctaText}>복습 시작하기</Text>}
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHOWROOM.bg },
  backdrop: { opacity: 0.55, transform: [{ scale: 1.3 }] },
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: SHOWROOM.glass, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageCenter: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', borderRadius: 40 },
  info: { paddingHorizontal: 24, paddingBottom: 8, gap: 8 },
  chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 },
  levelChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  levelText: { fontSize: 12, fontWeight: '700' },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    maxWidth: 200,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    backgroundColor: SHOWROOM.glass,
  },
  linkText: { flexShrink: 1, color: SHOWROOM.fg, fontSize: 12, fontWeight: '600' },
  panel: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: SHOWROOM.glass, gap: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#FFFFFF26', marginVertical: 6 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  panelCaption: { color: SHOWROOM.fgDim, fontSize: 11, fontWeight: '500' },
  panelTitle: { flex: 1, color: SHOWROOM.fg, fontSize: 13, fontWeight: '600' },
  panelNote: { color: SHOWROOM.fgDim, fontSize: 11, lineHeight: 15 },
  panelValue: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  panelTotal: { color: SHOWROOM.fgDim, fontSize: 12, fontWeight: '500' },
  goalTrack: { marginTop: 4, height: 4, borderRadius: 999, backgroundColor: '#FFFFFF1F', overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 999 },
  cta: { height: 44, borderRadius: 14, backgroundColor: SHOWROOM.fg, alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: SHOWROOM.bg, fontSize: 15, fontWeight: '700' },
});
