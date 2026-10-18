import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { RootStackParamList } from '../navigation/AppNavigator';
import { deckApi } from '../api/deckApi';
import SongCardShowcase from '../components/rewardCards/SongCardShowcase';
import CardShareButton from '../components/rewardCards/CardShareButton';
import GradePanel, { GradeTab } from '../components/rewardCards/GradePanel';
import { IntroDecision, reportIntroDecision } from '../components/rewardCards/CardIntroDebugOverlay';
import { EXPLAINER_IN_MS, EXPLAINER_OUT_MS } from '../components/rewardCards/CardRevealStage';
import { CARD_RATIO, LEVEL_MATERIAL, MASTER_CHIP, SHOWROOM, songTierName, useCardFonts } from '../components/rewardCards/cardTheme';
import { useCardTilt } from '../components/rewardCards/useCardTilt';
import { useRefreshCardsOnReturn } from '../components/rewardCards/useRefreshCardsOnReturn';
import { useShallow } from 'zustand/react/shallow';
import { SONG_CARD_KINDS, songCardOfKind, songCardSample, songCardsOf, songRung } from '../components/rewardCards/cardKinds';
import { serverTargetId } from '../components/rewardCards/serverRewardCards';
import { songGradeCondition } from '../components/rewardCards/songGradeCondition';
import type { CardGoal } from '../components/rewardCards/types';
import { useRewardCardStore } from '../stores/rewardCardStore';

type Props = NativeStackScreenProps<RootStackParamList, 'RewardCardDetail'>;

interface Box {
  y: number;
  width: number;
  height: number;
}

// 기울이면 원근 때문에 카드가 테 밖으로 조금 나온다.
const STAGE_INSET = 16;
const FOCUS_INSET = 24;


const NO_GOALS: Partial<Record<number, CardGoal>> = {};

const SONG_TABS: readonly GradeTab[] = SONG_CARD_KINDS.map((kind) => {
  const material = kind.mastered ? MASTER_CHIP : LEVEL_MATERIAL[kind.level];
  return { key: kind.key, label: songTierName(kind.level, kind.mastered), frame: material.frame, ink: material.chipText };
});

export default function RewardCardDetailScreen({ navigation, route }: Props) {
  const { cardId } = route.params;
  const opened = useRewardCardStore((s) => s.songCards.find((c) => c.id === cardId));
  // 등급마다 카드가 따로라, 다른 칸을 누르면 그 등급의 내 카드로 바꿔 보여 준다.
  const siblings = useRewardCardStore(
    useShallow((s) => (opened ? songCardsOf(s.songCards, opened.songId, opened.title) : [])),
  );
  // 푸시로 들어오면 카드를 아직 받는 중일 수 있다.
  const loading = useRewardCardStore((s) => s.serverStatus === 'loading');
  const gradeRule = useRewardCardStore((s) => s.songGradeRule);
  const songCondition = useCallback((rung: number) => songGradeCondition(rung, gradeRule).full, [gradeRule]);
  const ownedRung = siblings.reduce((top, c) => Math.max(top, songRung(c)), opened ? songRung(opened) : 0);
  const [pickedRung, setPickedRung] = useState<number | null>(null);
  const viewRung = pickedRung ?? (opened ? songRung(opened) : 0);
  const owned = pickedRung == null ? opened : songCardOfKind(siblings, SONG_CARD_KINDS[viewRung]) ?? undefined;
  // 아직 받지 않은 등급은 주인 정보를 비운 새 견본이다.
  const card = useMemo(
    () => owned ?? (opened ? songCardSample(opened, SONG_CARD_KINDS[viewRung]) : undefined),
    [owned, opened, viewRung],
  );
  // 견본엔 복습할 때가 된 단어 수가 맞지 않는다.
  const isSample = owned == null;
  const wearOf = owned ?? opened ?? card;
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
  const infoIn = useAnimatedStyle(() => ({ opacity: info.value, transform: [{ translateY: (1 - info.value) * 12 }] }));

  // 설명 화면은 같은 아트 배경 위에 뜨므로, 화면 전환 대신 내용만 비우고 채운다.
  const away = useSharedValue(0);
  // 가사 편집은 저장을 기다리지 않고 돌아와, 바로 다시 받으면 옛 가사로 덮인다. 설명 화면은 카드를 바꾸지 않는다.
  const skipNextRefresh = useRefreshCardsOnReturn(navigation);
  const awayStyle = useAnimatedStyle(() => ({ opacity: 1 - away.value, transform: [{ scale: 1 - away.value * 0.04 }] }));
  const openExplainer = useCallback(
    (params: RootStackParamList['RewardCardReveal']) => {
      const go = () => {
        skipNextRefresh();
        navigation.navigate('RewardCardReveal', params);
      };
      away.value = withTiming(1, { duration: EXPLAINER_OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(go)();
      });
    },
    [away, navigation, skipNextRefresh],
  );
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        if (away.value > 0) away.value = withTiming(0, { duration: EXPLAINER_IN_MS, easing: Easing.out(Easing.cubic) });
      }),
    [away, navigation],
  );
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


  const handleClose = useCallback(() => navigation.goBack(), [navigation]);
  const handleSelectRung = useCallback((rung: number) => setPickedRung(rung), []);

  // 채우기로 받은 카드는 획득 연출을 거치지 않아, 규칙을 본 적 없으면 어느 경로로 들어왔든 설명부터 띄운다.
  // 아직 발급 전인 카드는 획득 화면이 곧 같은 설명을 하므로 건너뛴다.
  const issued = opened?.issued === true;
  const introCheckedRef = useRef(false);
  const title = opened?.title ?? cardId;
  const setIntroDecision = useCallback((decision: IntroDecision) => reportIntroDecision(cardId, title, decision), [cardId, title]);
  useEffect(() => {
    if (!introCheckedRef.current) setIntroDecision('waiting');
  }, [setIntroDecision]);
  useEffect(() => {
    if (!issued || introCheckedRef.current) return;
    introCheckedRef.current = true;
    setIntroDecision('checking');
    let cancelled = false;
    useRewardCardStore
      .getState()
      .loadWearIntroSeen()
      .finally(() => {
        const state = useRewardCardStore.getState();
        if (cancelled) return;
        if (state.wearIntroSeen) return setIntroDecision('seen');
        if (state.active) return setIntroDecision('revealing');
        setIntroDecision('shown');
        openExplainer({ kind: 'song', cardId, intro: true });
      });
    return () => {
      cancelled = true;
    };
  }, [issued, openExplainer, cardId, setIntroDecision]);

  const handleWearInfo = useCallback(() => {
    openExplainer({ kind: 'song', cardId, wearOnly: true });
  }, [openExplainer, cardId]);
  const viewedId = owned?.id ?? null;
  const handleEditLyric = useCallback(() => {
    if (viewedId == null) return;
    skipNextRefresh();
    navigation.navigate('RewardCardLyricEdit', { cardId: viewedId });
  }, [navigation, skipNextRefresh, viewedId]);

  const songId = card?.songId ?? null;
  const shareId = owned?.issued === true ? serverTargetId(owned.id) : null;
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
            {loading ? (
              <ActivityIndicator color={SHOWROOM.fgDim} />
            ) : (
              <Text style={styles.missingText}>카드를 찾을 수 없어요</Text>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const goals = opened?.goals ?? NO_GOALS;

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
        <Animated.View style={[styles.safe, awayStyle]} onLayout={handleBodyLayout}>
          <Pressable style={StyleSheet.absoluteFill} disabled={!focused} onPress={handleUnfocus} />
          <Animated.View style={[styles.topBar, chromeStyle]} pointerEvents={focused ? 'none' : 'auto'}>
            <Pressable onPress={handleClose} hitSlop={10} style={styles.iconBtn}>
              <Feather name="chevron-down" size={22} color={SHOWROOM.fg} />
            </Pressable>
            <View style={styles.actions}>
              {shareId != null && <CardShareButton kind="song" cardId={shareId} title={card.title} tilt={tilt} cardRef={cardRef} accent={card.accent} ink={card.ink} />}
              <Pressable onPress={handleFocus} hitSlop={10} style={styles.iconBtn}>
                <Feather name="maximize-2" size={17} color={SHOWROOM.fg} />
              </Pressable>
              {!isSample && (
                <Pressable onPress={handleEditLyric} hitSlop={10} style={styles.iconBtn}>
                  <Feather name="edit-3" size={18} color={SHOWROOM.fg} />
                </Pressable>
              )}
            </View>
          </Animated.View>

          <View style={styles.stage} pointerEvents="box-none" onLayout={handleStageLayout}>
            {cardW > 0 && (
              <Animated.View style={[styles.stageCenter, focusStyle]} pointerEvents="box-none">
                <GestureDetector gesture={tilt.gesture}>
                  <Animated.View style={cardIn}>
                    <View ref={cardRef} collapsable={false}>
                      <SongCardShowcase card={card} width={cardW} tilt={tilt} fonts={fonts} ownerName={route.params.ownerName} />
                    </View>
                  </Animated.View>
                </GestureDetector>
              </Animated.View>
            )}
          </View>

          <Animated.View style={chromeStyle} pointerEvents={focused ? 'none' : 'auto'}>
            <Animated.View style={[styles.info, infoIn]}>
              <View style={[styles.wear, isSample && styles.wearMuted]}>
                <Pressable onPress={handleWearInfo} hitSlop={10} style={styles.wearInfo}>
                  <Text style={styles.wearLabel}>복습할 때가 된 단어</Text>
                  <Feather name="info" size={13} color={SHOWROOM.fgDim} />
                </Pressable>
                <Text style={styles.wearValue}>{wearOf?.dueCount ?? 0}/{wearOf?.reviewedCount ?? 0}</Text>
              </View>

              <GradePanel
                tabs={SONG_TABS}
                owned={ownedRung}
                selected={viewRung}
                goals={goals}
                condition={songCondition}
                onSelect={handleSelectRung}
              />

              <View style={styles.ctaRow}>
                <Pressable
                  onPress={handleOpenSong}
                  disabled={songId == null}
                  style={({ pressed }) => [styles.subCta, songId == null && styles.ctaDisabled, pressed && styles.ctaPressed]}
                >
                  <Text style={styles.subCtaText}>곡 보기</Text>
                </Pressable>
                <Pressable
                  onPress={handleStartReview}
                  disabled={songId == null || isStartingReview}
                  style={({ pressed }) => [styles.cta, songId == null && styles.ctaDisabled, pressed && styles.ctaPressed]}
                >
                  {isStartingReview ? <ActivityIndicator color={SHOWROOM.bg} /> : <Text style={styles.ctaText}>복습 시작하기</Text>}
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
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
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: SHOWROOM.glass, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageCenter: { alignItems: 'center', justifyContent: 'center' },
  info: { paddingHorizontal: 24, paddingBottom: 8, gap: 8 },
  wear: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  wearInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wearMuted: { opacity: 0.35 },
  wearLabel: { color: SHOWROOM.fgDim, fontSize: 13, fontWeight: '500' },
  wearValue: { color: SHOWROOM.fg, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  subCta: { height: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: SHOWROOM.glass, alignItems: 'center', justifyContent: 'center' },
  subCtaText: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '600' },
  cta: { flex: 1, height: 44, borderRadius: 14, backgroundColor: SHOWROOM.fg, alignItems: 'center', justifyContent: 'center' },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: SHOWROOM.bg, fontSize: 15, fontWeight: '700' },
});
