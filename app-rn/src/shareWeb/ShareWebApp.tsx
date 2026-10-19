import React, { useCallback, useEffect, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { OwnerAvatar, SharedCardShowcase, sharedCardArtwork, useSharedCards } from '../components/rewardCards/SharedCardStage';
import { RevealGuide } from '../components/rewardCards/CardRevealStage';
import { ARTIST_CARD_RATIO, CARD_RATIO, SHOWROOM } from '../components/rewardCards/cardTheme';
import { APP_PITCH, shareHook } from '../services/shareLinks';
import type { SharedRewardCardDto } from '../types/rewardCard';
import FitText, { FitLines } from './FitText';
import StoreBadge, { type Store } from './StoreBadge';
import { readShareWebData, storeOf, type ShareWebData } from './shareWebData';
import { shareCelebration, shareLadder, sharePitch, shareWearNote, type RankLine, type ShareWearNote } from './shareWebCopy';

const APP_ICON = require('../../assets/icon.png');
const COLUMN_W = 440;
// 머리줄·제목·카드 아래 힌트가 카드와 함께 첫 화면에 들어오게 남기는 높이.
const HERO_CHROME = 260;
const STEPS: readonly [icon: React.ComponentProps<typeof Feather>['name'], label: string][] = [
  ['music', '좋아하는 일본 노래 고르기'],
  ['repeat', '가사 속 단어 복습하기'],
  ['award', '공부한 만큼 카드 받기'],
];

/** share-web 빌드의 루트. 서버가 랜딩 HTML 에 실어 준 카드를 축하하고, 받은 사람을 앱 설치로 부른다. */
export default function ShareWebApp() {
  const data = useMemo(readShareWebData, []);
  const store = useMemo(() => storeOf(typeof navigator === 'undefined' ? '' : navigator.userAgent), []);
  const artwork = data ? sharedCardArtwork(data.card) : null;

  const open = useCallback(
    (target: Store | 'app') => {
      if (!data) return;
      window.location.href = target === 'app' ? data.appUrl : target === 'ios' ? data.iosAppStoreUrl : data.androidPlayUrl;
    },
    [data],
  );
  const handleOpenApp = useCallback(() => open('app'), [open]);

  return (
    <GestureHandlerRootView style={styles.root}>
      {artwork ? <Image source={{ uri: artwork }} style={[StyleSheet.absoluteFill, styles.backdrop]} blurRadius={48} /> : null}
      <LinearGradient
        colors={[`${SHOWROOM.bg}8C`, `${SHOWROOM.bg}E6`, SHOWROOM.bg]}
        locations={[0, 0.5, 0.85]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.topBar}>
            <View style={styles.brand}>
              <Image source={APP_ICON} style={styles.brandIcon} />
              <Text style={styles.brandName}>Kotonoha</Text>
            </View>
            {data && store ? (
              <Pressable onPress={handleOpenApp} hitSlop={8} style={({ pressed }) => [styles.openApp, pressed && styles.pressed]}>
                <Text style={styles.openAppText}>앱에서 열기</Text>
              </Pressable>
            ) : null}
          </View>
          {data ? <Celebration data={data} /> : <Text style={styles.missing}>카드를 찾을 수 없어요</Text>}
          <InstallPitch kind={data?.card.kind ?? 'SONG'} store={store} onOpen={open} />
        </View>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

/** 누가 어떤 카드를 얻었고, 그 카드가 얼마나 공부해야 받는 것인지. */
const Celebration = React.memo(function Celebration({ data }: { data: ShareWebData }) {
  const { card: shared } = data;
  const { width, height } = useWindowDimensions();
  const cards = useSharedCards(shared);
  const celebration = useMemo(() => shareCelebration(shared), [shared]);
  const ladder = useMemo(() => shareLadder(shared), [shared]);
  const wearNote = useMemo(() => shareWearNote(shared), [shared]);
  const accent = cards.songCard?.accent ?? cards.artistCard?.accent ?? SHOWROOM.fg;

  const inner = Math.min(width, COLUMN_W) - 40;
  const cardW = shared.songCard
    ? Math.max(180, Math.min(inner * 0.78, 300, (height - HERO_CHROME) / CARD_RATIO))
    : Math.max(240, Math.min(inner, 380, (height - HERO_CHROME) / ARTIST_CARD_RATIO));

  // 카드가 먼저 떠오르고, 그 아래 설명이 뒤따른 다음 계단이 지금 등급까지 차오른다.
  const rise = useSharedValue(0);
  const copyIn = useSharedValue(0);
  const pulse = useSharedValue(0);
  const guideMotion = useMemo(() => ({ copyIn, pulse }), [copyIn, pulse]);
  useEffect(() => {
    rise.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
    copyIn.value = withDelay(1100, withTiming(1, { duration: 1 }));
    pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [rise, copyIn, pulse]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, rise.value * 1.6),
    transform: [{ translateY: (1 - rise.value) * 36 }, { scale: 0.94 + 0.06 * rise.value }],
  }));
  const panelStyle = useAnimatedStyle(() => {
    const t = Math.max(0, (rise.value - 0.45) / 0.55);
    return { opacity: t, transform: [{ translateY: (1 - t) * 16 }] };
  });

  if (!celebration) return null;
  const { name, profileImageUrl } = shared.owner;

  return (
    <View style={styles.hero}>
      <View style={styles.owner}>
        <OwnerAvatar name={name} uri={profileImageUrl} size={28} />
        <FitText text={`${name}님이`} style={styles.ownerText} boxStyle={styles.ownerBox} />
      </View>
      <FitText text={celebration.subject} style={styles.headline} boxStyle={styles.subjectBox} minFontSize={18} />
      <FitText text={celebration.headline} style={styles.headline} />
      {celebration.rank && <RankRow line={celebration.rank} accent={accent} />}

      <Animated.View style={[styles.stage, cardStyle]}>
        <SharedCardShowcase {...cards} width={cardW} ownerName={name} />
      </Animated.View>
      <View style={styles.hint}>
        <Feather name="move" size={12} color={SHOWROOM.fgDim} />
        <FitText text="카드를 끌어 보세요. 옆으로 밀면 뒤집혀요" style={styles.hintText} boxStyle={styles.hintBox} />
      </View>

      <Animated.View style={[styles.reveal, panelStyle]}>
        {wearNote && <WearCallout note={wearNote} />}
        <View style={styles.panel}>
          <View style={styles.meaning}>
            <FitLines text={celebration.meaning} style={styles.meaningText} />
          </View>
          <RevealGuide lines={[]} steps={ladder} current={celebration.rung} accent={accent} motion={guideMotion} />
        </View>
      </Animated.View>
    </View>
  );
});

const RankRow = React.memo(function RankRow({ line, accent }: { line: RankLine; accent: string }) {
  return (
    <View style={styles.rank}>
      {line.lead && <Text style={styles.rankRest}>{line.lead}</Text>}
      <Text style={[styles.rankNo, { color: accent }]}>{line.no}</Text>
      <Text style={styles.rankRest}>{line.rest}</Text>
    </View>
  );
});

const WearCallout = React.memo(function WearCallout({ note }: { note: ShareWearNote }) {
  return (
    <View style={styles.wear}>
      <View style={styles.wearTitle}>
        <Feather name="alert-circle" size={16} color={SHOWROOM.fg} />
        <FitText text={note.title} style={styles.wearTitleText} boxStyle={styles.wearTitleBox} />
      </View>
      <FitLines text={note.body} style={styles.wearBody} />
    </View>
  );
});

interface PitchProps {
  kind: SharedRewardCardDto['kind'];
  store: Store | null;
  onOpen: (store: Store) => void;
}

/** 나도 카드를 갖고 싶어진 사람을 스토어로 보낸다. 내 기기 스토어를 앞에 둔다. */
const InstallPitch = React.memo(function InstallPitch({ kind, store, onOpen }: PitchProps) {
  const stores: Store[] = store === 'android' ? ['android', 'ios'] : ['ios', 'android'];
  return (
    <View style={styles.pitch}>
      <Image source={APP_ICON} style={styles.pitchIcon} />
      <FitText text={shareHook(kind === 'SONG' ? 'song' : 'artist')} style={styles.pitchHook} boxStyle={styles.pitchHookBox} />
      <View style={styles.pitchBody}>
        <FitLines text={sharePitch(kind)} style={styles.pitchBodyText} />
      </View>
      <View style={styles.steps}>
        {STEPS.map(([icon, label], i) => (
          <View key={icon} style={styles.step}>
            <View style={styles.stepIcon}>
              <Feather name={icon} size={18} color={SHOWROOM.fg} />
            </View>
            <Text style={styles.stepNo}>{i + 1}</Text>
            <FitText text={label} style={styles.stepLabel} boxStyle={styles.stepLabelBox} />
          </View>
        ))}
      </View>
      <View style={styles.badges}>
        {stores.map((s) => (
          <StoreBadge key={s} store={s} onPress={onOpen} />
        ))}
      </View>
      <FitText text={`Kotonoha · ${APP_PITCH}`} style={styles.footer} boxStyle={styles.footerBox} />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHOWROOM.bg, overflow: 'hidden' },
  backdrop: { opacity: 0.6, transform: [{ scale: 1.3 }] },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 40 },
  column: { width: '100%', maxWidth: COLUMN_W },
  pressed: { opacity: 0.8 },

  topBar: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon: { width: 28, height: 28, borderRadius: 7 },
  brandName: { color: SHOWROOM.fg, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  openApp: { height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: SHOWROOM.glass, justifyContent: 'center' },
  openAppText: { color: SHOWROOM.fg, fontSize: 13, fontWeight: '700' },
  missing: { color: SHOWROOM.fg, fontSize: 18, fontWeight: '700', textAlign: 'center', marginVertical: 80 },

  hero: { alignItems: 'center', paddingTop: 12 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  ownerBox: { alignSelf: 'auto', flexShrink: 1 },
  ownerText: { color: SHOWROOM.fgDim, fontSize: 16, fontWeight: '600' },
  subjectBox: { marginTop: 8 },
  headline: { color: SHOWROOM.fg, fontSize: 26, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
  rank: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  rankNo: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  rankRest: { color: SHOWROOM.fg, fontSize: 16, fontWeight: '700' },
  stage: { marginTop: 28 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, maxWidth: '100%' },
  hintBox: { alignSelf: 'auto', flexShrink: 1 },
  hintText: { color: SHOWROOM.fgDim, fontSize: 12 },

  reveal: { alignSelf: 'stretch', marginTop: 28, gap: 12 },
  wear: { padding: 16, borderRadius: 16, backgroundColor: SHOWROOM.glass, borderWidth: 1, borderColor: SHOWROOM.line, gap: 4 },
  wearTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  wearTitleBox: { flex: 1 },
  wearTitleText: { color: SHOWROOM.fg, fontSize: 16, fontWeight: '800' },
  wearBody: { color: SHOWROOM.fgDim, fontSize: 14, lineHeight: 21 },
  panel: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: SHOWROOM.glass,
    borderWidth: 1,
    borderColor: SHOWROOM.line,
  },
  meaning: { marginBottom: 6 },
  meaningText: { color: SHOWROOM.fg, fontSize: 17, fontWeight: '600', lineHeight: 25 },

  pitch: { alignItems: 'center', marginTop: 56, paddingTop: 40, borderTopWidth: 1, borderTopColor: SHOWROOM.line },
  pitchIcon: { width: 64, height: 64, borderRadius: 16 },
  pitchHookBox: { marginTop: 20 },
  pitchHook: { color: SHOWROOM.fg, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  pitchBody: { alignSelf: 'stretch', marginTop: 10 },
  pitchBodyText: { color: SHOWROOM.fgDim, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  // 좁은 화면에서 세 칸 가로 배치는 글이 꺾여, 한 줄씩 쌓는다.
  steps: { alignSelf: 'stretch', marginTop: 28, gap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: SHOWROOM.glass },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SHOWROOM.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNo: { color: SHOWROOM.fgDim, fontSize: 13, fontWeight: '800' },
  stepLabelBox: { flex: 1 },
  stepLabel: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '700' },
  badges: { flexDirection: 'row', alignSelf: 'stretch', gap: 10, marginTop: 32 },
  footerBox: { marginTop: 28 },
  footer: { color: SHOWROOM.fgDim, fontSize: 12, textAlign: 'center' },
});
