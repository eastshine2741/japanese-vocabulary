import React, { useCallback, useEffect, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { OwnerAvatar, SharedCardShowcase, sharedCardArtwork, useSharedCards } from '../components/rewardCards/SharedCardStage';
import { RevealGuide } from '../components/rewardCards/CardRevealStage';
import { ARTIST_CARD_RATIO, ARTIST_MATERIAL, CARD_RATIO, LEVEL_MATERIAL, MASTER_CHIP, SHOWROOM } from '../components/rewardCards/cardTheme';
import { ARTIST_GRADE_STEPS } from '../components/rewardCards/artistGrade';
import { songGradeOf } from '../components/rewardCards/serverRewardCards';
import { APP_PITCH, shareHook } from '../services/shareLinks';
import type { SharedRewardCardDto } from '../types/rewardCard';
import StoreBadge, { type Store } from './StoreBadge';
import { readShareWebData, storeOf, type ShareWebData } from './shareWebData';
import { shareCelebration, shareLadder, sharePitch } from './shareWebCopy';

const APP_ICON = require('../../assets/icon.png');
const COLUMN_W = 440;
// 머리줄·제목·카드 아래 힌트가 카드와 함께 첫 화면에 들어오게 남기는 높이.
const HERO_CHROME = 260;
const STEPS: readonly [icon: React.ComponentProps<typeof Feather>['name'], label: string][] = [
  ['music', '좋아하는 노래 고르기'],
  ['repeat', '가사 속 단어 복습'],
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

function chipOf(shared: SharedRewardCardDto, rung: number): { colors: readonly [string, string, ...string[]]; text: string } {
  if (shared.songCard) {
    const { level, mastered } = songGradeOf(shared.songCard.grade);
    if (mastered) return { colors: MASTER_CHIP.frame, text: MASTER_CHIP.chipText };
    return { colors: LEVEL_MATERIAL[level].frame, text: LEVEL_MATERIAL[level].chipText };
  }
  const material = ARTIST_MATERIAL[ARTIST_GRADE_STEPS[rung].grade];
  return { colors: material.frame, text: material.chipText };
}

/** 누가 어떤 카드를 얻었고, 그 카드가 얼마나 공부해야 받는 것인지. */
const Celebration = React.memo(function Celebration({ data }: { data: ShareWebData }) {
  const { card: shared } = data;
  const { width, height } = useWindowDimensions();
  const cards = useSharedCards(shared);
  const celebration = useMemo(() => shareCelebration(shared), [shared]);
  const ladder = useMemo(() => shareLadder(shared), [shared]);
  const accent = cards.songCard?.accent ?? cards.artistCard?.accent ?? SHOWROOM.fg;
  const chip = useMemo(() => chipOf(shared, celebration?.rung ?? 0), [shared, celebration]);

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
        <Text style={styles.ownerText} numberOfLines={1}>
          {name}님이
        </Text>
      </View>
      <Text style={styles.headline}>{celebration.headline}</Text>

      <Animated.View style={[styles.stage, cardStyle]}>
        <SharedCardShowcase {...cards} width={cardW} ownerName={name} />
      </Animated.View>
      <View style={styles.hint}>
        <Feather name="move" size={12} color={SHOWROOM.fgDim} />
        <Text style={styles.hintText}>카드를 끌어 보세요. 옆으로 밀면 뒤집혀요</Text>
      </View>

      <Animated.View style={[styles.panel, panelStyle]}>
        <View style={styles.rankRow}>
          <LinearGradient colors={chip.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
            <Text style={[styles.chipText, { color: chip.text }]}>{celebration.grade}</Text>
          </LinearGradient>
          <Text style={styles.rankText} numberOfLines={1}>
            {celebration.rank}
          </Text>
        </View>
        <Text style={styles.meaning}>{celebration.meaning}</Text>
        <RevealGuide lines={[]} steps={ladder} current={celebration.rung} accent={accent} motion={guideMotion} />
      </Animated.View>
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
      <Text style={styles.pitchHook}>{shareHook(kind === 'SONG' ? 'song' : 'artist')}</Text>
      <Text style={styles.pitchBody}>{sharePitch(kind)}</Text>
      <View style={styles.steps}>
        {STEPS.map(([icon, label], i) => (
          <View key={icon} style={styles.step}>
            <View style={styles.stepIcon}>
              <Feather name={icon} size={18} color={SHOWROOM.fg} />
            </View>
            <Text style={styles.stepNo}>{i + 1}</Text>
            <Text style={styles.stepLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.badges}>
        {stores.map((s) => (
          <StoreBadge key={s} store={s} onPress={onOpen} />
        ))}
      </View>
      <Text style={styles.footer}>Kotonoha · {APP_PITCH}</Text>
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
  ownerText: { color: SHOWROOM.fgDim, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  headline: { color: SHOWROOM.fg, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center', marginTop: 8 },
  stage: { marginTop: 28 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  hintText: { color: SHOWROOM.fgDim, fontSize: 12 },

  panel: {
    alignSelf: 'stretch',
    marginTop: 28,
    padding: 20,
    borderRadius: 20,
    backgroundColor: SHOWROOM.glass,
    borderWidth: 1,
    borderColor: SHOWROOM.line,
  },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  rankText: { color: SHOWROOM.fg, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  meaning: { color: SHOWROOM.fg, fontSize: 17, fontWeight: '600', lineHeight: 25, marginTop: 14, marginBottom: 6 },

  pitch: { alignItems: 'center', marginTop: 56, paddingTop: 40, borderTopWidth: 1, borderTopColor: SHOWROOM.line },
  pitchIcon: { width: 64, height: 64, borderRadius: 16 },
  pitchHook: { color: SHOWROOM.fg, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center', marginTop: 20 },
  pitchBody: { color: SHOWROOM.fgDim, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  steps: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 28, gap: 8 },
  step: { flex: 1, alignItems: 'center' },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SHOWROOM.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNo: { color: SHOWROOM.fgDim, fontSize: 11, fontWeight: '700', marginTop: 10 },
  stepLabel: { color: SHOWROOM.fg, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  badges: { flexDirection: 'row', alignSelf: 'stretch', gap: 10, marginTop: 32 },
  footer: { color: SHOWROOM.fgDim, fontSize: 12, marginTop: 28 },
});
