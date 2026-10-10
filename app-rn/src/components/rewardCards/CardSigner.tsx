import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { hapticOwned, hapticSign } from './cardHaptics';
import { SongCardBack, SongCardFront } from './SongCardShowcase';
import { CARD_RATIO, CardFonts, SHOWROOM } from './cardTheme';
import { CardSignature } from './signature';
import { SongRewardCard } from './types';

interface Props {
  card: SongRewardCard;
  fonts: CardFonts;
  previewWidth: number;
  /** 서명 뒤 카드가 앞면으로 돌아서는 장면의 카드 폭. */
  sealWidth: number;
  /** 서명을 확정하는 순간. 이 뒤로는 되돌릴 수 없다. */
  onSign: (signature: CardSignature) => void;
  onDone: () => void;
  bottomInset: number;
}

/**
 * 서명 → 내 카드가 되는 순간까지.
 * 빈 서명 칸을 점선으로 짚는다. 확정하면 서명된 뒷면 그대로 앞면으로 돌려 주인 이름과 순번을 붙인다.
 */
function CardSigner({ card, fonts, previewWidth, sealWidth, onSign, onDone, bottomInset }: Props) {
  const [strokes, setStrokes] = useState<CardSignature>([]);
  const [sealed, setSealed] = useState<CardSignature | null>(null);

  const handleClear = useCallback(() => setStrokes([]), []);

  const signature = strokes.length > 0 ? strokes : null;
  const handleConfirm = useCallback(() => {
    if (!signature) return;
    hapticSign();
    onSign(signature);
    setSealed(signature);
  }, [onSign, signature]);
  const empty = signature === null;

  if (sealed) {
    return <CardSeal card={card} signature={sealed} fonts={fonts} width={sealWidth} onDone={onDone} bottomInset={bottomInset} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.preview}>
        <View style={[styles.previewCard, { borderRadius: previewWidth * 0.046 }]}>
          <SongCardBack card={card} width={previewWidth} fonts={fonts} signatureHint={card.accent} />
        </View>
      </View>

      <View style={styles.padArea}>
        <View style={styles.head}>
          <Text style={styles.headTitle}>소유자 서명</Text>
          <Pressable onPress={handleClear} disabled={empty} hitSlop={8} style={[styles.clear, empty && styles.clearDisabled]}>
            <Feather name="rotate-ccw" size={14} color={SHOWROOM.fgDim} />
            <Text style={styles.clearText}>다시 쓰기</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: bottomInset + 16 }]}>
        <Pressable
          onPress={handleConfirm}
          disabled={empty}
          style={({ pressed }) => [styles.cta, empty && styles.ctaDisabled, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>서명하고 받기</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default React.memo(CardSigner);

/** 미리보기에서 본 서명된 뒷면을 잠깐 보여 준 뒤 돌린다. */
const FLIP_AT_MS = 650;
const FLIP_MS = 820;
const SETTLE = Easing.out(Easing.cubic);

interface SealProps {
  card: SongRewardCard;
  signature: CardSignature;
  fonts: CardFonts;
  width: number;
  onDone: () => void;
  bottomInset: number;
}

const CardSeal = React.memo(function CardSeal({ card, signature, fonts, width, onDone, bottomInset }: SealProps) {
  const ownerName = useAuthStore((s) => s.userName?.trim()) || '나';
  const signed = useMemo(() => ({ ...card, signature }), [card, signature]);
  const flip = useSharedValue(0);
  const lift = useSharedValue(0);
  const captionIn = useSharedValue(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const flipAt = FLIP_AT_MS;
    flip.value = withDelay(
      flipAt,
      withTiming(1, { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(hapticOwned)();
      }),
    );
    lift.value = withDelay(
      flipAt,
      withSequence(
        withTiming(1, { duration: FLIP_MS / 2, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: FLIP_MS / 2 + 200, easing: SETTLE }),
      ),
    );
    captionIn.value = withDelay(
      flipAt + FLIP_MS - 120,
      withTiming(1, { duration: 480, easing: SETTLE }, (finished) => {
        if (finished) runOnJS(setDone)(true);
      }),
    );
  }, [flip, lift, captionIn]);

  const stageStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.06 * lift.value }] }));
  const captionStyle = useAnimatedStyle(() => ({
    opacity: captionIn.value,
    transform: [{ translateY: (1 - captionIn.value) * 14 }],
  }));

  const earned = card.earnedAt.replace(/-/g, '.');

  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.root}>
      <View style={styles.sealStage}>
        <Animated.View style={stageStyle}>
          <FlipCard card={signed} width={width} fonts={fonts} flip={flip} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.caption, captionStyle]}>
        <Text style={[styles.owner, { fontFamily: fonts.koBold }]} numberOfLines={1}>
          {ownerName}의 카드
        </Text>
        <Text style={styles.meta}>
          <Text style={{ color: card.accent }}>No.{card.ownerNo.toLocaleString('ko-KR')}</Text>
          {'  ·  '}
          {earned} 발급
        </Text>
      </Animated.View>

      <Animated.View style={[styles.footer, { paddingBottom: bottomInset + 16 }, captionStyle]}>
        <Pressable
          onPress={onDone}
          disabled={!done}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>확인</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
});

interface FlipProps {
  card: SongRewardCard;
  width: number;
  fonts: CardFonts;
  /** 0 = 뒷면, 1 = 앞면. */
  flip: SharedValue<number>;
}

const FlipCard = React.memo(function FlipCard({ card, width, fonts, flip }: FlipProps) {
  const height = width * CARD_RATIO;
  const radius = width * 0.046;
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 1100 }, { rotateY: `${flip.value * 180}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 0 : 1,
    transform: [{ perspective: 1100 }, { rotateY: `${flip.value * 180 - 180}deg` }],
  }));
  return (
    <View style={{ width, height }}>
      <Animated.View style={[styles.flipFace, { borderRadius: radius }, backStyle]}>
        <SongCardBack card={card} width={width} fonts={fonts} />
      </Animated.View>
      <Animated.View
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[styles.flipFace, { borderRadius: radius }, frontStyle]}
      >
        <SongCardFront card={card} width={width} fonts={fonts} />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  previewCard: { boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)' },
  padArea: { paddingHorizontal: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  headTitle: { color: SHOWROOM.fg, fontSize: 15, fontWeight: '700' },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearDisabled: { opacity: 0.35 },
  clearText: { color: SHOWROOM.fgDim, fontSize: 13, fontWeight: '600' },
  footer: { paddingHorizontal: 24, paddingTop: 20 },
  cta: {
    height: 52,
    borderRadius: 16,
    backgroundColor: SHOWROOM.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.35 },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: SHOWROOM.bg, fontSize: 16, fontWeight: '700' },
  sealStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flipFace: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
  },
  caption: { alignItems: 'center', paddingHorizontal: 32, gap: 6 },
  owner: { color: SHOWROOM.fg, fontSize: 24 },
  meta: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
