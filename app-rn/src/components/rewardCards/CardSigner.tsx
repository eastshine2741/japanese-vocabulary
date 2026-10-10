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
import { hapticCount, hapticLand, hapticOwned, hapticSign } from './cardHaptics';
import { SHOWROOM } from './cardTheme';
import SignaturePad from './SignaturePad';
import { CardSignature } from './signature';

/** 곡·아티스트 카드가 서명 단계에 내놓는 면. 콜백은 매 렌더 새로 만들지 않게 useCallback 으로 넘긴다. */
export interface SignableCard {
  accent: string;
  /** 세로 / 가로. */
  ratio: number;
  /** 모서리 반경, 카드 폭 비율. */
  radius: number;
  /** 획득 순번 문구의 주어. '이 곡' · '이 아티스트'. */
  subject: string;
  serialNo: number;
  /** hint 가 있으면 빈 서명 칸을 그 색 점선으로 짚는다. */
  renderBack: (width: number, signature: CardSignature | null, hint?: string) => React.ReactNode;
  renderFront: (width: number) => React.ReactNode;
}

interface Props {
  card: SignableCard;
  previewWidth: number;
  /** 서명 뒤 카드가 앞면으로 돌아서는 장면의 카드 폭. */
  sealWidth: number;
  /** 서명을 확정하는 순간. 이 뒤로는 되돌릴 수 없다. */
  onSign: (signature: CardSignature) => void;
  onDone: () => void;
  /** 발급 뒤 확인 버튼 라벨. 이어지는 화면이 있으면 '다음'. */
  doneLabel?: string;
  bottomInset: number;
}

/**
 * 서명 → 내 카드가 되는 순간까지.
 * 빈 서명 칸을 점선으로 짚고, 패드에 그리는 획을 미리보기 카드에 그대로 찍는다. 확정하면 서명된 뒷면 그대로 앞면으로 돌려 주인 이름과 순번을 붙인다.
 */
function CardSigner({ card, previewWidth, sealWidth, onSign, onDone, doneLabel = '확인', bottomInset }: Props) {
  const [strokes, setStrokes] = useState<CardSignature>([]);
  const [live, setLive] = useState<string | null>(null);
  const [sealed, setSealed] = useState<CardSignature | null>(null);

  const handleClear = useCallback(() => setStrokes([]), []);
  const handleStroke = useCallback((stroke: string) => setStrokes((prev) => [...prev, stroke]), []);
  const preview = useMemo(() => (live ? [...strokes, live] : strokes), [strokes, live]);

  const signature = strokes.length > 0 ? strokes : null;
  const handleConfirm = useCallback(() => {
    if (!signature) return;
    hapticSign();
    onSign(signature);
    setSealed(signature);
  }, [onSign, signature]);
  const empty = signature === null;

  if (sealed) {
    return <CardSeal card={card} signature={sealed} width={sealWidth} onDone={onDone} doneLabel={doneLabel} bottomInset={bottomInset} />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.preview}>
        <View style={[styles.previewCard, { borderRadius: previewWidth * card.radius }]}>
          {card.renderBack(previewWidth, preview, card.accent)}
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
        <SignaturePad strokes={strokes} onDraw={setLive} onStroke={handleStroke} />
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
/** 순번이 0 부터 올라가 멈추는 시간. 끝으로 갈수록 느려진다. */
const COUNT_MS = 1100;
/** 숫자가 바뀔 때마다 울리면 뭉개져서 이 간격 아래로는 건너뛴다. */
const COUNT_TICK_MS = 45;
const SETTLE = Easing.out(Easing.cubic);

interface SealProps {
  card: SignableCard;
  signature: CardSignature;
  width: number;
  onDone: () => void;
  doneLabel: string;
  bottomInset: number;
}

const CardSeal = React.memo(function CardSeal({ card, signature, width, onDone, doneLabel, bottomInset }: SealProps) {
  const flip = useSharedValue(0);
  const lift = useSharedValue(0);
  const captionIn = useSharedValue(0);
  const [counting, setCounting] = useState(false);
  const [done, setDone] = useState(false);
  const handleCounted = useCallback(() => setDone(true), []);

  useEffect(() => {
    const flipAt = FLIP_AT_MS;
    flip.value = withDelay(
      flipAt,
      withTiming(1, { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(hapticOwned)();
          runOnJS(setCounting)(true);
        }
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
      withTiming(1, { duration: 480, easing: SETTLE }),
    );
  }, [flip, lift, captionIn]);

  const stageStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.06 * lift.value }] }));
  const captionStyle = useAnimatedStyle(() => ({
    opacity: captionIn.value,
    transform: [{ translateY: (1 - captionIn.value) * 14 }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.root}>
      <View style={styles.sealStage}>
        <Animated.View style={stageStyle}>
          <FlipCard card={card} signature={signature} width={width} flip={flip} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.caption, captionStyle]}>
        <Text style={styles.owner} numberOfLines={1}>
          카드를 획득했어요!
        </Text>
        <Text style={styles.meta}>
          {card.subject}의 카드를 전체 유저 중{' '}
          <SerialCount to={card.serialNo} run={counting} color={card.accent} onDone={handleCounted} />로 획득했어요
        </Text>
      </Animated.View>

      <Animated.View style={[styles.footer, { paddingBottom: bottomInset + 16 }, captionStyle]}>
        <Pressable
          onPress={onDone}
          disabled={!done}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{doneLabel}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
});

interface CountProps {
  to: number;
  run: boolean;
  color: string;
  onDone: () => void;
}

/** 획득 순번이 0 부터 올라가다 멈추며 내 카드로 확정된다. 멈추는 순간이 마지막 한 방이다. */
const SerialCount = React.memo(function SerialCount({ to, run, color, onDone }: CountProps) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!run) return;
    const t0 = Date.now();
    let shown = 0;
    let lastTick = 0;
    let raf = 0;
    const step = () => {
      const now = Date.now();
      const k = Math.min(1, (now - t0) / COUNT_MS);
      const next = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (next !== shown) {
        shown = next;
        setN(next);
        if (k < 1 && now - lastTick >= COUNT_TICK_MS) {
          lastTick = now;
          hapticCount();
        }
      }
      if (k < 1) {
        raf = requestAnimationFrame(step);
        return;
      }
      hapticLand();
      onDone();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, to, onDone]);

  return <Text style={{ color }}>{n.toLocaleString('ko-KR')}번째</Text>;
});

interface FlipProps {
  card: SignableCard;
  signature: CardSignature;
  width: number;
  /** 0 = 뒷면, 1 = 앞면. */
  flip: SharedValue<number>;
}

const FlipCard = React.memo(function FlipCard({ card, signature, width, flip }: FlipProps) {
  const height = width * card.ratio;
  const radius = width * card.radius;
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
        {card.renderBack(width, signature)}
      </Animated.View>
      <Animated.View
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[styles.flipFace, { borderRadius: radius }, frontStyle]}
      >
        {card.renderFront(width)}
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
  owner: { color: SHOWROOM.fg, fontSize: 24, fontWeight: '700' },
  meta: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'center' },
});
