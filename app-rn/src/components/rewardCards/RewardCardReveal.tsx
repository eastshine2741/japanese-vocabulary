import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SharedValue,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigate } from '../../navigation/navigationRef';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import { useStreakStore } from '../../stores/streakStore';
import CardLyricEditor from './CardLyricEditor';
import CardSigner from './CardSigner';
import { hapticLand } from './cardHaptics';
import LevelPips from './LevelPips';
import SongCardShowcase, { SongCardBack, SongCardFront } from './SongCardShowcase';
import { CARD_RATIO, CardFonts, LEVEL_MATERIAL, SHOWROOM, useCardFonts } from './cardTheme';
import { findDummyLyrics } from './dummyRewardCards';
import { CardSignature } from './signature';
import { SongRewardCard } from './types';
import { useCardTilt } from './useCardTilt';

const CARD_AT_MS = 180;
/** 뒷면으로 떠올라 한 바퀴 반을 돌고 앞면에서 멈춘다. flip 1 = 180°. */
const SPIN_TURNS = 3;
const SPIN_MS = 1400;
const LAND_AT_MS = CARD_AT_MS + SPIN_MS - 120;
const COPY_AT_MS = LAND_AT_MS + 120;
const CTA_AT_MS = COPY_AT_MS + 260;
const LIVE_FADE_MS = 240;
/** 아트를 못 받아도 이 시간 뒤엔 띄운다. */
const PREFETCH_TIMEOUT_MS = 1500;
const SETTLE = Easing.out(Easing.cubic);

/**
 * 곡 카드 획득 — 조건이 채워지면 획득 화면(RewardCardReveal 라우트)을 연다.
 * 연속 학습 축하가 떠 있으면 그 화면이 닫힐 때까지 기다린다.
 * 위에 겹쳐 그리면 아래 화면까지 매 프레임 다시 합성돼 끊기므로, 스택 화면으로 띄워 아래 화면을 떼어 낸다.
 */
export const RewardCardRevealHost = React.memo(function RewardCardRevealHost() {
  const cardId = useRewardCardStore((s) => s.revealCardId);
  const artworkUrl = useRewardCardStore((s) => s.songCards.find((c) => c.id === s.revealCardId)?.artworkUrl);
  const streakShowing = useStreakStore((s) => s.celebration !== null);

  useEffect(() => {
    if (!cardId || streakShowing) return;
    let pending = true;
    const open = () => {
      if (!pending) return;
      pending = false;
      useRewardCardStore.getState().dismissReveal();
      navigate('RewardCardReveal', { cardId });
    };
    // 회전 도중 아트가 늦게 받아져 튀어나오지 않도록 미리 받아 둔다.
    const timer = setTimeout(open, PREFETCH_TIMEOUT_MS);
    if (artworkUrl) Image.prefetch(artworkUrl).then(open, open);
    else open();
    return () => {
      pending = false;
      clearTimeout(timer);
    };
  }, [cardId, artworkUrl, streakShowing]);

  return null;
});

/** 서명은 발급 때 한 번뿐이라 빠뜨릴 수 없다 — 가사를 고르든 그대로 받든 마지막엔 서명한다. */
type Step = 'reveal' | 'pick' | 'sign';

interface RevealProps {
  card: SongRewardCard;
  /** 화면 전환이 끝나면 true. 전환과 회전이 겹치지 않게 그때 연출을 시작한다. */
  started: boolean;
  onClose: () => void;
}

export const RewardCardReveal = React.memo(function RewardCardReveal({ card, started, onClose }: RevealProps) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const fonts = useCardFonts();
  const tilt = useCardTilt();
  const lines = useMemo(() => findDummyLyrics(card.id), [card.id]);
  const setLyric = useRewardCardStore((s) => s.setLyric);
  const sign = useRewardCardStore((s) => s.sign);
  const [step, setStep] = useState<Step>('reveal');
  // 서명 단계에서 뒤로 가면 들어온 단계로 돌아간다.
  const [signFrom, setSignFrom] = useState<'reveal' | 'pick'>('reveal');
  // 서명한 뒤엔 되돌아갈 곳이 없다.
  const [signed, setSigned] = useState(false);
  // 도는 동안은 효과 없는 정적 카드를 돌리고, 착지 연출이 끝나면 기울기 효과가 있는 카드로 겹쳐 바꾼다.
  const [live, setLive] = useState(false);
  const [spinDone, setSpinDone] = useState(false);

  const rise = useSharedValue(0);
  const flash = useSharedValue(0);
  const ring = useSharedValue(0);
  const pulse = useSharedValue(0);
  const copyIn = useSharedValue(0);
  const ctaIn = useSharedValue(0);
  const spin = useSharedValue(SPIN_TURNS);
  const liveIn = useSharedValue(0);

  useEffect(() => {
    if (!started) return;
    rise.value = withDelay(CARD_AT_MS, withSpring(1, { damping: 15, stiffness: 90, mass: 1 }));
    spin.value = withDelay(CARD_AT_MS, withTiming(0, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) }));
    flash.value = withDelay(
      LAND_AT_MS,
      withSequence(
        withTiming(1, { duration: 90 }, (finished) => {
          if (finished) runOnJS(hapticLand)();
        }),
        withTiming(0, { duration: 520, easing: SETTLE }),
      ),
    );
    ring.value = withDelay(
      LAND_AT_MS,
      withTiming(1, { duration: 900, easing: SETTLE }, (finished) => {
        if (finished) runOnJS(setLive)(true);
      }),
    );
    pulse.value = withDelay(LAND_AT_MS, withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true));
    copyIn.value = withDelay(COPY_AT_MS, withTiming(1, { duration: 420, easing: SETTLE }));
    ctaIn.value = withDelay(CTA_AT_MS, withTiming(1, { duration: 420, easing: SETTLE }));
  }, [started, rise, spin, flash, ring, pulse, copyIn, ctaIn]);

  useEffect(() => {
    if (!live) return;
    liveIn.value = withTiming(1, { duration: LIVE_FADE_MS }, (finished) => {
      if (finished) runOnJS(setSpinDone)(true);
    });
  }, [live, liveIn]);

  const handlePick = useCallback(() => setStep('pick'), []);
  const handleKeep = useCallback(() => {
    setSignFrom('reveal');
    setStep('sign');
  }, []);
  const handleBack = useCallback(() => setStep((prev) => (prev === 'sign' ? signFrom : 'reveal')), [signFrom]);
  const handleLyric = useCallback(
    (picked: number[]) => {
      setLyric(card.id, picked);
      setSignFrom('pick');
      setStep('sign');
    },
    [card.id, setLyric],
  );
  const handleSign = useCallback(
    (signature: CardSignature) => {
      sign(card.id, signature);
      setSigned(true);
    },
    [card.id, sign],
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // 첫 단계에서 뒤로 가기는 막는다 — 서명 없이 닫히면 서명할 기회가 다시 없다.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step !== 'reveal' && !signed) handleBack();
      return true;
    });
    return () => sub.remove();
  }, [step, signed, handleBack]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, rise.value * 2),
    transform: [{ translateY: (1 - rise.value) * 160 }, { scale: 0.55 + rise.value * 0.45 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: ring.value * (0.75 + 0.25 * pulse.value),
    transform: [{ scale: 0.9 + 0.08 * pulse.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.15, 1], [0, 0.8, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.7, 1.7]) }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: 0.4 * flash.value }));
  const liveStyle = useAnimatedStyle(() => ({ opacity: liveIn.value }));

  const cardW = Math.min(screenW * 0.66, (screenH * 0.46) / CARD_RATIO, 320);
  const material = LEVEL_MATERIAL[card.level];

  return (
    <View style={styles.root}>
      <Image source={{ uri: card.artworkUrl }} style={[StyleSheet.absoluteFill, styles.backdrop]} blurRadius={40} />
      <LinearGradient
        colors={[`${SHOWROOM.bg}99`, `${SHOWROOM.bg}E0`, SHOWROOM.bg]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {step === 'reveal' ? (
        <Animated.View
          key="reveal"
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(160)}
          style={[styles.step, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
        >
          <Rise progress={copyIn} from={10} style={styles.eyebrow}>
            <LinearGradient colors={material.frame} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.levelChip}>
              <LevelPips level={card.level} color={material.chipText} size={5} />
              <Text style={[styles.levelText, { color: material.chipText }]}>새 곡 카드</Text>
            </LinearGradient>
          </Rise>

          <View style={styles.stage}>
            <Animated.View
              pointerEvents="none"
              renderToHardwareTextureAndroid
              style={[styles.glow, { width: cardW * 2.2, height: cardW * 2.2 }, glowStyle]}
            >
              <Svg width="100%" height="100%">
                <Defs>
                  <RadialGradient id="rewardCardGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0" stopColor={card.accent} stopOpacity={0.55} />
                    <Stop offset="0.5" stopColor={card.accent} stopOpacity={0.16} />
                    <Stop offset="1" stopColor={card.accent} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#rewardCardGlow)" />
              </Svg>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ring,
                { width: cardW * 1.1, height: cardW * 1.1 * CARD_RATIO, borderColor: card.accent, borderRadius: cardW * 0.08 },
                ringStyle,
              ]}
            />
            <Animated.View style={cardStyle}>
              {!spinDone && <SpinCard card={card} width={cardW} fonts={fonts} spin={spin} />}
              {live && (
                <Animated.View style={[spinDone ? null : styles.over, liveStyle]}>
                  <GestureDetector gesture={tilt.gesture}>
                    <View>
                      <SongCardShowcase card={card} width={cardW} tilt={tilt} fonts={fonts} />
                    </View>
                  </GestureDetector>
                </Animated.View>
              )}
            </Animated.View>
          </View>

          <Rise progress={copyIn} from={14} style={styles.copy}>
            <Text style={[styles.title, { fontFamily: fonts.jpHeavy }]} numberOfLines={1}>{card.title}</Text>
            <Text style={[styles.artist, { color: card.accent }]} numberOfLines={1}>{card.artist}</Text>
          </Rise>

          <Rise progress={ctaIn} from={20} style={styles.actions}>
            <Pressable onPress={handlePick} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
              <Text style={styles.ctaText}>가사 고르기</Text>
            </Pressable>
            <Pressable onPress={handleKeep} hitSlop={8} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>이대로 받기</Text>
            </Pressable>
          </Rise>
        </Animated.View>
      ) : (
        <Animated.View key={step} entering={FadeIn.duration(240)} style={[styles.step, { paddingTop: insets.top + 4 }]}>
          <View style={styles.topBar}>
            {signed ? (
              <View style={styles.iconSlot} />
            ) : (
              <Pressable onPress={handleBack} hitSlop={10} style={styles.iconBtn}>
                <Feather name="chevron-left" size={22} color={SHOWROOM.fg} />
              </Pressable>
            )}
          </View>
          {step === 'pick' ? (
            <CardLyricEditor
              card={card}
              lines={lines}
              fonts={fonts}
              previewWidth={Math.min(screenW * 0.34, 150)}
              ctaLabel="다음"
              onConfirm={handleLyric}
              bottomInset={insets.bottom}
            />
          ) : (
            <CardSigner
              card={card}
              fonts={fonts}
              previewWidth={Math.min(screenW * 0.42, 190)}
              sealWidth={cardW}
              onSign={handleSign}
              onDone={onClose}
              bottomInset={insets.bottom}
            />
          )}
        </Animated.View>
      )}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
    </View>
  );
});

interface SpinCardProps {
  card: SongRewardCard;
  width: number;
  fonts: CardFonts;
  /** 1 = 180°. 0 이면 앞면. */
  spin: SharedValue<number>;
}

/** 효과 레이어 없는 앞·뒷면을 텍스처로 한 번 그려 두고 회전만 바꾼다. */
const SpinCard = React.memo(function SpinCard({ card, width, fonts, spin }: SpinCardProps) {
  const height = width * CARD_RATIO;
  const radius = width * 0.046;
  const frontStyle = useAnimatedStyle(() => {
    const deg = spin.value * 180;
    return {
      opacity: Math.cos((deg * Math.PI) / 180) > 0 ? 1 : 0,
      transform: [{ perspective: 1100 }, { rotateY: `${deg}deg` }],
    };
  });
  const backStyle = useAnimatedStyle(() => {
    const deg = spin.value * 180;
    return {
      opacity: Math.cos((deg * Math.PI) / 180) > 0 ? 0 : 1,
      transform: [{ perspective: 1100 }, { rotateY: `${deg + 180}deg` }],
    };
  });
  return (
    <View style={{ width, height }}>
      <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.spinFace, { borderRadius: radius }, frontStyle]}>
        <SongCardFront card={card} width={width} fonts={fonts} />
      </Animated.View>
      <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.spinFace, { borderRadius: radius }, backStyle]}>
        <SongCardBack card={card} width={width} fonts={fonts} />
      </Animated.View>
    </View>
  );
});

interface RiseProps {
  progress: SharedValue<number>;
  from: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const Rise = React.memo(function Rise({ progress, from, style, children }: RiseProps) {
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * from }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SHOWROOM.bg },
  backdrop: { opacity: 0.5, transform: [{ scale: 1.3 }] },
  step: { flex: 1 },
  eyebrow: { alignItems: 'center' },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelText: { fontSize: 13, fontWeight: '700' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 2 },
  spinFace: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backfaceVisibility: 'hidden' },
  over: { position: 'absolute', top: 0, left: 0 },
  copy: { alignItems: 'center', paddingHorizontal: 32, gap: 4 },
  title: { color: SHOWROOM.fg, fontSize: 26 },
  artist: { fontSize: 14, fontWeight: '600' },
  actions: { paddingHorizontal: 24, paddingTop: 24, gap: 6 },
  cta: {
    height: 52,
    borderRadius: 16,
    backgroundColor: SHOWROOM.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: SHOWROOM.bg, fontSize: 16, fontWeight: '700' },
  secondary: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  topBar: { flexDirection: 'row', paddingHorizontal: 16 },
  iconSlot: { width: 40, height: 40 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SHOWROOM.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flash: { backgroundColor: '#FFFFFF' },
});
