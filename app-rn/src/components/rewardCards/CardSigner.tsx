import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
import CardShareButton from './CardShareButton';
import { hapticBurst, hapticCount, hapticSettle, hapticSign } from './cardHaptics';
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

/** 발급된 서버 카드면 공유할 수 있다. */
export interface ShareableCard {
  kind: 'song' | 'artist';
  cardId: number;
  title: string;
  accent: string;
  ink: string;
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
  /** 있으면 발급 뒤 '친구에게 자랑하기'로 공유 메뉴를 연다. */
  share?: ShareableCard | null;
  bottomInset: number;
}

/**
 * 서명 → 내 카드가 되는 순간까지.
 * 빈 서명 칸을 점선으로 짚고, 패드에 그리는 획을 미리보기 카드에 그대로 찍는다. 확정하면 서명된 뒷면 그대로 앞면으로 돌려 주인 이름과 순번을 붙인다.
 */
function CardSigner({ card, previewWidth, sealWidth, onSign, onDone, doneLabel = '확인', share = null, bottomInset }: Props) {
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
    return (
      <CardSeal card={card} signature={sealed} width={sealWidth} onDone={onDone} doneLabel={doneLabel} share={share} bottomInset={bottomInset} />
    );
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

/** 미리보기에서 본 서명된 뒷면을 잠깐 보여 준 뒤, 화면이 번쩍이며 한 번 뒤집힌다. */
const HOLD_MS = 650;
const FLIP_MS = 700;
const SLAM_MS = 180;
/** 순번이 0 부터 올라가 멈추는 시간. 끝으로 갈수록 느려진다. */
const COUNT_MS = 1600;
/** 숫자가 바뀔 때마다 울리면 뭉개져서 이 간격 아래로는 건너뛴다. */
const COUNT_TICK_MS = 45;
/** 올라가는 동안 숫자가 커지는 정도. 멈출 때 제 크기로 박힌다. */
const COUNT_GROW = 0.08;
const SETTLE = Easing.out(Easing.cubic);

interface SealProps {
  card: SignableCard;
  signature: CardSignature;
  width: number;
  onDone: () => void;
  doneLabel: string;
  share: ShareableCard | null;
  bottomInset: number;
}

const CardSeal = React.memo(function CardSeal({ card, signature, width, onDone, doneLabel, share, bottomInset }: SealProps) {
  const cardRef = useRef<View>(null);
  const spin = useSharedValue(0);
  const flash = useSharedValue(0);
  const captionIn = useSharedValue(0);
  const [counting, setCounting] = useState(false);
  const [done, setDone] = useState(false);
  const handleCounted = useCallback(() => setDone(true), []);
  const renderShareTrigger = useCallback(
    (open: () => void, opening: boolean) => (
      <Pressable onPress={open} disabled={!done || opening} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
        {opening ? <ActivityIndicator color={SHOWROOM.bg} /> : <Text style={styles.ctaText}>친구에게 자랑하기</Text>}
      </Pressable>
    ),
    [done],
  );

  useEffect(() => {
    spin.value = withDelay(
      HOLD_MS,
      withTiming(180, { duration: FLIP_MS, easing: SETTLE }, (finished) => {
        if (finished) runOnJS(setCounting)(true);
      }),
    );
    flash.value = withDelay(
      HOLD_MS,
      withSequence(
        withTiming(0.85, { duration: 45 }, (finished) => {
          if (finished) runOnJS(hapticBurst)();
        }),
        withTiming(0, { duration: 900, easing: SETTLE }),
      ),
    );
    captionIn.value = withDelay(HOLD_MS + FLIP_MS, withTiming(1, { duration: 420, easing: SETTLE }));
  }, [spin, flash, captionIn]);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const captionStyle = useAnimatedStyle(() => ({
    opacity: captionIn.value,
    transform: [{ translateY: (1 - captionIn.value) * 14 }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(260)} style={styles.root}>
      <View style={styles.sealStage}>
        <View ref={cardRef} collapsable={false}>
          <FlipCard card={card} signature={signature} width={width} spin={spin} />
        </View>
      </View>

      <Animated.View style={[styles.caption, captionStyle]}>
        <Text style={styles.owner} numberOfLines={1}>
          카드를 획득했어요!
        </Text>
        <Text style={styles.meta}>{card.subject} 카드를 전체 유저 중</Text>
        <SerialCount to={card.serialNo} run={counting} color={card.accent} onDone={handleCounted} />
      </Animated.View>

      <Animated.View style={[styles.footer, { paddingBottom: bottomInset + (share ? 4 : 16) }, captionStyle]}>
        {share ? (
          <>
            <CardShareButton
              kind={share.kind}
              cardId={share.cardId}
              title={share.title}
              cardRef={cardRef}
              accent={share.accent}
              ink={share.ink}
              renderTrigger={renderShareTrigger}
            />
            <Pressable onPress={onDone} disabled={!done} hitSlop={8} style={({ pressed }) => [styles.secondary, pressed && styles.ctaPressed]}>
              <Text style={styles.secondaryText}>{doneLabel}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={onDone} disabled={!done} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
            <Text style={styles.ctaText}>{doneLabel}</Text>
          </Pressable>
        )}
      </Animated.View>
      {/* 단계 틀의 여백·상단 막대까지 덮어야 화면 전체가 번쩍인다. */}
      <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} />
    </Animated.View>
  );
});

interface CountProps {
  to: number;
  run: boolean;
  color: string;
  onDone: () => void;
}

/** 획득 순번이 0 부터 올라가며 살짝 커지다가 멈추는 순간 제 크기로 돌아온다. */
const SerialCount = React.memo(function SerialCount({ to, run, color, onDone }: CountProps) {
  const [n, setN] = useState(0);
  const grow = useSharedValue(0);

  useEffect(() => {
    if (!run) return;
    grow.value = withTiming(1, { duration: COUNT_MS, easing: Easing.out(Easing.quad) });
    const t0 = Date.now();
    let shown = 0;
    let lastTick = 0;
    let raf = 0;
    const step = () => {
      const now = Date.now();
      const k = Math.min(1, (now - t0) / COUNT_MS);
      const next = Math.round(to * (1 - Math.pow(1 - k, 4)));
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
      grow.value = withTiming(0, { duration: SLAM_MS, easing: Easing.out(Easing.cubic) });
      hapticSettle();
      onDone();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, to, onDone, grow]);

  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + COUNT_GROW * grow.value }] }));

  return (
    <View style={styles.serialRow}>
      <Animated.Text style={[styles.serial, { color }, numberStyle]}>{n.toLocaleString('ko-KR')}번째</Animated.Text>
      <Text style={styles.serialTail}>로 획득했어요</Text>
    </View>
  );
});

interface FlipProps {
  card: SignableCard;
  signature: CardSignature;
  width: number;
  /** 돈 각도(도). 0 = 뒷면, 180 = 앞면. */
  spin: SharedValue<number>;
}

// 각도로 한 면만 보이게 한다 — backfaceVisibility 는 안드로이드에서 믿을 수 없다.
const FlipCard = React.memo(function FlipCard({ card, signature, width, spin }: FlipProps) {
  const height = width * card.ratio;
  const radius = width * card.radius;
  const backStyle = useAnimatedStyle(() => ({
    opacity: Math.cos((spin.value * Math.PI) / 180) >= 0 ? 1 : 0,
    transform: [{ perspective: 1100 }, { rotateY: `${spin.value}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: Math.cos((spin.value * Math.PI) / 180) < 0 ? 1 : 0,
    transform: [{ perspective: 1100 }, { rotateY: `${spin.value - 180}deg` }],
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
  secondary: { height: 44, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600' },
  sealStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flipFace: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
  },
  caption: { alignItems: 'center', paddingHorizontal: 32, gap: 6 },
  owner: { color: SHOWROOM.fg, fontSize: 24, fontWeight: '700' },
  meta: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  serialRow: { flexDirection: 'row', alignItems: 'baseline' },
  serial: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  serialTail: { color: SHOWROOM.fgDim, fontSize: 14, fontWeight: '600' },
  flash: { position: 'absolute', top: -300, bottom: -300, left: -100, right: -100, backgroundColor: '#FFFFFF' },
});
