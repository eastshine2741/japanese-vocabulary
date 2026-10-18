import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigate } from '../../navigation/navigationRef';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import { useStreakStore } from '../../stores/streakStore';
import CardLyricEditor from './CardLyricEditor';
import CardSigner, { ShareableCard, SignableCard } from './CardSigner';
import CardWearIntro from './CardWearIntro';
import {
  EXPLAINER_IN_MS,
  EXPLAINER_OUT_MS,
  RevealGuide,
  RevealIntro,
  RevealPrimaryButton,
  RevealSecondaryButton,
  RevealShell,
  RevealStep,
  revealCheer,
  useRevealBackGuard,
  useRevealMotion,
} from './CardRevealStage';
import SongCardShowcase, { SongCardBack, SongCardFront } from './SongCardShowcase';
import { CARD_RATIO, SHOWROOM, songTierName, useCardFonts } from './cardTheme';
import { SONG_CARD_KINDS, songRung } from './cardKinds';
import { songLadder } from './cardLadders';
import { CardSignature } from './signature';
import { CardLyricLine, SongRewardCard } from './types';
import { serverTargetId } from './serverRewardCards';
import { useCardTilt } from './useCardTilt';

/** 아트를 못 받아도 이 시간 뒤엔 띄운다. */
const PREFETCH_TIMEOUT_MS = 1500;
const NO_LINES: CardLyricLine[] = [];
const SONG_RADIUS = 0.046;

const SONG_GUIDE = ['단계를 끝낼 때마다 다음 등급 카드를 새로 받아요'];
const SONG_LAST_GUIDE = ['이 곡의 마지막 등급 카드예요'];
const SONG_LAST_RUNG = SONG_CARD_KINDS.length - 1;
const INTRO_GUIDE = ['곡 단어를 처음 공부하면 얻는 카드예요.', '단계를 끝낼 때마다 다음 등급 카드를 새로 받아요'];
const INTRO_LADDER_DELAY_MS = 500;

/**
 * 카드 획득 — 조건이 채워지면 획득 화면(RewardCardReveal 라우트)을 연다.
 * 연속 학습 축하가 떠 있으면 그 화면이 닫힐 때까지 기다린다.
 * 위에 겹쳐 그리면 아래 화면까지 매 프레임 다시 합성돼 끊기므로, 스택 화면으로 띄워 아래 화면을 떼어 낸다.
 */
export const RewardCardRevealHost = React.memo(function RewardCardRevealHost() {
  const next = useRewardCardStore((s) => (s.active ? null : s.queue[0] ?? null));
  const imageUrl = useRewardCardStore((s) =>
    next?.kind === 'song'
      ? s.songCards.find((c) => c.id === next.cardId)?.artworkUrl
      : next
        ? s.artistCards.find((c) => c.id === next.cardId)?.imageUrl
        : undefined,
  );
  const streakShowing = useStreakStore((s) => s.celebration !== null);

  useEffect(() => {
    useRewardCardStore.getState().loadWearIntroSeen();
  }, []);

  useEffect(() => {
    if (!next || streakShowing) return;
    let pending = true;
    const open = () => {
      if (!pending) return;
      pending = false;
      const target = useRewardCardStore.getState().openNextReveal();
      if (target) navigate('RewardCardReveal', { kind: target.kind, cardId: target.cardId, queued: true });
    };
    // 회전 도중 아트가 늦게 받아져 튀어나오지 않도록 미리 받아 둔다.
    const timer = setTimeout(open, PREFETCH_TIMEOUT_MS);
    if (imageUrl) Image.prefetch(imageUrl).then(open, open);
    else open();
    return () => {
      pending = false;
      clearTimeout(timer);
    };
  }, [next, imageUrl, streakShowing]);

  return null;
});

/** 서명은 발급 때 한 번뿐이라 빠뜨릴 수 없다 — 가사를 고르든 그대로 받든 서명한다. 첫 카드면 낡음 설명이 뒤따른다. */
type Step = 'reveal' | 'pick' | 'sign' | 'guide' | 'wear';

interface RevealProps {
  card: SongRewardCard;
  /** 화면 전환이 끝나면 true. 전환과 회전이 겹치지 않게 그때 연출을 시작한다. */
  started: boolean;
  onClose: () => void;
  /** 상세의 (i) — 낡음 설명만 띄우고, 본 것으로 치지 않으며 뒤로 가기로 닫힌다. */
  wearOnly?: boolean;
  /** 연출 없이 받은 카드 — 봉투·서명 없이 획득·승급 계단과 낡음 설명만 보여 준다. */
  intro?: boolean;
}

export const RewardCardReveal = React.memo(function RewardCardReveal({
  card: received,
  started,
  onClose,
  wearOnly = false,
  intro = false,
}: RevealProps) {
  // 다른 곡에서 밀린 단어로 받자마자 낡아 보이지 않게, 받는 화면은 늘 새 카드로 그린다.
  const card = useMemo(() => ({ ...received, dueCount: 0 }), [received]);
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const fonts = useCardFonts();
  const tilt = useCardTilt();
  const motion = useRevealMotion(started);
  const lines = useRewardCardStore((s) => s.lyricLines[card.id]) ?? NO_LINES;
  useEffect(() => {
    useRewardCardStore.getState().loadLyricLines(card.id);
  }, [card.id]);
  const setLyric = useRewardCardStore((s) => s.setLyric);
  const sign = useRewardCardStore((s) => s.sign);
  const markWearIntroSeen = useRewardCardStore((s) => s.markWearIntroSeen);
  const gradeRule = useRewardCardStore((s) => s.songGradeRule);
  const ladder = useMemo(() => songLadder(gradeRule), [gradeRule]);
  // 연 순간 기준으로 고정해야 도중에 버튼 라벨이 바뀌지 않는다.
  const [showWearIntro] = useState(() => !useRewardCardStore.getState().wearIntroSeen);
  const [step, setStep] = useState<Step>(wearOnly ? 'wear' : intro ? 'guide' : 'reveal');
  // 서명 단계에서 뒤로 가면 들어온 단계로 돌아간다.
  const [signFrom, setSignFrom] = useState<'reveal' | 'pick'>('reveal');
  const [signed, setSigned] = useState(false);

  // 설명만 보는 화면은 화면 전환 없이 열리므로 내용을 스스로 띄우고, 닫을 때도 비운 뒤 닫는다.
  const explainer = wearOnly || intro;
  const presence = useSharedValue(explainer ? 0 : 1);
  useEffect(() => {
    if (explainer) presence.value = withTiming(1, { duration: EXPLAINER_IN_MS, easing: Easing.out(Easing.cubic) });
  }, [explainer, presence]);
  const presenceStyle = useAnimatedStyle(() => ({
    opacity: presence.value,
    transform: [{ translateY: (1 - presence.value) * 16 }],
  }));
  const closingRef = useRef(false);
  const close = useCallback(() => {
    if (!explainer) return onClose();
    if (closingRef.current) return;
    closingRef.current = true;
    presence.value = withTiming(0, { duration: EXPLAINER_OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [explainer, presence, onClose]);

  const handlePick = useCallback(() => setStep('pick'), []);
  const handleKeep = useCallback(() => {
    setSignFrom('reveal');
    setStep('sign');
  }, []);
  const handleBack = useCallback(() => {
    // 설명만 보는 화면은 막을 서명이 없어 첫 단계에서 뒤로 가면 닫는다.
    if (wearOnly || (intro && step === 'guide')) close();
    else if (intro) setStep('guide');
    else setStep((prev) => (prev === 'sign' ? signFrom : 'reveal'));
  }, [wearOnly, intro, close, signFrom, step]);
  const handleGuideDone = useCallback(() => setStep('wear'), []);
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
      sign('song', card.id, signature);
      setSigned(true);
    },
    [card.id, sign],
  );
  const handleSealed = useCallback(() => (showWearIntro ? setStep('wear') : onClose()), [showWearIntro, onClose]);
  const handleWearDone = useCallback(() => {
    if (!wearOnly) markWearIntroSeen();
    close();
  }, [wearOnly, markWearIntroSeen, close]);
  useRevealBackGuard(!intro && step === 'reveal', signed, handleBack);

  // 설명 단계는 봉투 연출이 없어, 화면이 다 열리면 계단만 채운다.
  const guideCopyIn = useSharedValue(0);
  const guidePulse = useSharedValue(0);
  const guideMotion = useMemo(() => ({ copyIn: guideCopyIn, pulse: guidePulse }), [guideCopyIn, guidePulse]);
  useEffect(() => {
    if (!intro || !started) return;
    guideCopyIn.value = withDelay(INTRO_LADDER_DELAY_MS, withTiming(1, { duration: 1 }));
    guidePulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [intro, started, guideCopyIn, guidePulse]);

  const renderBack = useCallback(
    (width: number, signature: CardSignature | null, hint?: string) => (
      <SongCardBack card={card} width={width} fonts={fonts} signature={signature} signatureHint={hint} />
    ),
    [card, fonts],
  );
  const renderFront = useCallback((width: number) => <SongCardFront card={card} width={width} fonts={fonts} />, [card, fonts]);
  const signable = useMemo<SignableCard>(
    () => ({
      accent: card.accent,
      ratio: CARD_RATIO,
      radius: SONG_RADIUS,
      subject: `이 곡의 ${songTierName(card.level, card.mastered)}`,
      serialNo: card.ownerNo,
      renderBack,
      renderFront,
    }),
    [card.accent, card.level, card.mastered, card.ownerNo, renderBack, renderFront],
  );

  const shareId = card.issued === true ? serverTargetId(card.id) : null;
  const share = useMemo<ShareableCard | null>(
    () => (shareId == null ? null : { kind: 'song', cardId: shareId, title: card.title, accent: card.accent, ink: card.ink }),
    [shareId, card.title, card.accent, card.ink],
  );

  const cardW = Math.min(screenW * 0.66, (screenH * 0.42) / CARD_RATIO, 320);

  return (
    <RevealShell backdropUri={card.artworkUrl} motion={motion} flash={!explainer}>
      <Animated.View style={[styles.presence, presenceStyle]}>
        {step === 'reveal' ? (
          <RevealIntro
            motion={motion}
            tilt={tilt}
            accent={card.accent}
            width={cardW}
            ratio={CARD_RATIO}
            radius={SONG_RADIUS}
            front={<SongCardFront card={card} width={cardW} fonts={fonts} />}
            back={<SongCardBack card={card} width={cardW} fonts={fonts} />}
            showcase={<SongCardShowcase card={card} width={cardW} tilt={tilt} fonts={fonts} />}
            cheer={revealCheer(songRung(card), SONG_LAST_RUNG)}
            heading={songRung(card) === 0 ? '곡 카드를 얻었어요' : `${songTierName(card.level, card.mastered)} 카드를 얻었어요`}
            guide={
              <RevealGuide lines={songRung(card) === SONG_LAST_RUNG ? SONG_LAST_GUIDE : SONG_GUIDE} steps={ladder} current={songRung(card)} accent={card.accent} motion={motion} />
            }
            actions={
              <>
                <RevealPrimaryButton label="가사 고르기" onPress={handlePick} />
                <RevealSecondaryButton label="이대로 받기" onPress={handleKeep} />
              </>
            }
          />
        ) : (
          <RevealStep key={step} onBack={signed || step === 'guide' ? null : handleBack}>
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
            ) : step === 'guide' ? (
              <View style={[styles.guideStep, { paddingBottom: insets.bottom + 16 }]}>
                <Text style={styles.guideTitle}>그동안 공부한 곡이 카드가 됐어요</Text>
                <View style={styles.guideStage}>
                  <GestureDetector gesture={tilt.gesture}>
                    <View>
                      <SongCardShowcase card={card} width={cardW} tilt={tilt} fonts={fonts} />
                    </View>
                  </GestureDetector>
                </View>
                <RevealGuide lines={INTRO_GUIDE} steps={ladder} current={songRung(card)} accent={card.accent} motion={guideMotion} />
                <View style={styles.guideActions}>
                  <RevealPrimaryButton label="다음" onPress={handleGuideDone} />
                </View>
              </View>
            ) : step === 'wear' ? (
              <CardWearIntro
                card={card}
                fonts={fonts}
                previewWidth={Math.min(screenW * 0.46, (screenH * 0.34) / CARD_RATIO)}
                accent={card.accent}
                bottomInset={insets.bottom}
                onDone={handleWearDone}
              />
            ) : (
              <CardSigner
                card={signable}
                previewWidth={Math.min(screenW * 0.42, 190)}
                sealWidth={cardW}
                onSign={handleSign}
                onDone={handleSealed}
                doneLabel={showWearIntro ? '다음' : '확인'}
                share={share}
                bottomInset={insets.bottom}
              />
            )}
          </RevealStep>
        )}
      </Animated.View>
    </RevealShell>
  );
});

const styles = StyleSheet.create({
  presence: { flex: 1 },
  guideStep: { flex: 1, paddingHorizontal: 24 },
  guideTitle: { color: SHOWROOM.fg, fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  guideStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  guideActions: { paddingTop: 24 },
});
