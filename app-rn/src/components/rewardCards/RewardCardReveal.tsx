import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Easing, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigate } from '../../navigation/navigationRef';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import { useStreakStore } from '../../stores/streakStore';
import CardLyricEditor from './CardLyricEditor';
import CardSigner, { SignableCard } from './CardSigner';
import { CardUpgrade, useUpgradeMotion } from './CardUpgrade';
import CardWearIntro from './CardWearIntro';
import {
  LadderStep,
  RevealGuide,
  RevealIntro,
  RevealPrimaryButton,
  RevealSecondaryButton,
  RevealShell,
  RevealStep,
  useRevealBackGuard,
  useRevealMotion,
} from './CardRevealStage';
import SongCardShowcase, { SongCardBack, SongCardFront, songUpgradeFocus } from './SongCardShowcase';
import { CARD_RATIO, SHOWROOM, SONG_MASTER_NAME, SONG_TIER_NAME, songTierName, useCardFonts } from './cardTheme';
import { previousSongCard, songRung } from './cardUpgrade';
import { songGradeOf } from './serverRewardCards';
import { CardSignature } from './signature';
import { CardLyricLine, SongRewardCard } from './types';
import { useCardTilt } from './useCardTilt';

/** 아트를 못 받아도 이 시간 뒤엔 띄운다. */
const PREFETCH_TIMEOUT_MS = 1500;
const NO_LINES: CardLyricLine[] = [];
const SONG_RADIUS = 0.046;

/** 레벨 n 은 n번째 단계 단어를 다 공부한 카드다. 등급 이름에 단계 이름을 쓰지 않고 조건으로만 붙인다. */
const SONG_LADDER: readonly LadderStep[] = [
  { label: SONG_TIER_NAME[0], caption: '첫 학습' },
  { label: SONG_TIER_NAME[1], caption: '후렴 정복' },
  { label: SONG_TIER_NAME[2], caption: '따라 부르기' },
  { label: SONG_TIER_NAME[3], caption: '완곡' },
  { label: SONG_MASTER_NAME, caption: '90% 장기 기억' },
];
const SONG_GUIDE = ['이 곡의 단어를 공부하는 만큼 강화되는 카드예요.', '각 단계를 끝낼 때마다 등급이 올라요'];
const INTRO_GUIDE = ['곡 단어를 처음 공부하면 얻는 카드예요.', '각 단계를 끝낼 때마다 등급이 올라요'];
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
      if (target) navigate('RewardCardReveal', { ...target, queued: true });
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
  /** 개발용 — 낡음 설명만 바로 띄우고, 본 것으로 치지 않으며 뒤로 가기로 닫힌다. */
  debugWearIntro?: boolean;
  /** 연출 없이 받은 카드 — 봉투·서명 없이 획득·승급 계단과 낡음 설명만 보여 준다. */
  intro?: boolean;
}

export const RewardCardReveal = React.memo(function RewardCardReveal({
  card,
  started,
  onClose,
  debugWearIntro = false,
  intro = false,
}: RevealProps) {
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
  // 연 순간 기준으로 고정해야 도중에 버튼 라벨이 바뀌지 않는다.
  const [showWearIntro] = useState(() => !useRewardCardStore.getState().wearIntroSeen);
  const [step, setStep] = useState<Step>(debugWearIntro ? 'wear' : intro ? 'guide' : 'reveal');
  // 서명 단계에서 뒤로 가면 들어온 단계로 돌아간다.
  const [signFrom, setSignFrom] = useState<'reveal' | 'pick'>('reveal');
  const [signed, setSigned] = useState(false);

  const handlePick = useCallback(() => setStep('pick'), []);
  const handleKeep = useCallback(() => {
    setSignFrom('reveal');
    setStep('sign');
  }, []);
  const handleBack = useCallback(() => {
    // 설명만 보는 화면은 막을 서명이 없어 첫 단계에서 뒤로 가면 닫는다.
    if (debugWearIntro || (intro && step === 'guide')) onClose();
    else if (intro) setStep('guide');
    else setStep((prev) => (prev === 'sign' ? signFrom : 'reveal'));
  }, [debugWearIntro, intro, onClose, signFrom, step]);
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
    if (!debugWearIntro) markWearIntroSeen();
    onClose();
  }, [debugWearIntro, markWearIntroSeen, onClose]);
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
      subject: '이 곡',
      serialNo: card.ownerNo,
      renderBack,
      renderFront,
    }),
    [card.accent, card.ownerNo, renderBack, renderFront],
  );

  const cardW = Math.min(screenW * 0.66, (screenH * 0.42) / CARD_RATIO, 320);

  return (
    <RevealShell backdropUri={card.artworkUrl} motion={motion}>
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
          heading="곡 카드를 얻었어요"
          guide={
            <RevealGuide lines={SONG_GUIDE} steps={SONG_LADDER} current={songRung(card)} accent={card.accent} motion={motion} />
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
              <RevealGuide lines={INTRO_GUIDE} steps={SONG_LADDER} current={songRung(card)} accent={card.accent} motion={guideMotion} />
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
              bottomInset={insets.bottom}
            />
          )}
        </RevealStep>
      )}
    </RevealShell>
  );
});

interface UpgradeProps {
  card: SongRewardCard;
  /** 오르기 전 등급(서버). 없으면 한 단계 아래 카드로 만든다. */
  fromGrade?: string | null;
  started: boolean;
  onClose: () => void;
}

/** 이미 가진 곡 카드의 등급이 올랐을 때. 새 다이아를 박으면 한 단계 아래 카드 위로 지금 재질이 번진다. */
export const SongCardUpgrade = React.memo(function SongCardUpgrade({ card, fromGrade, started, onClose }: UpgradeProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const fonts = useCardFonts();
  const tilt = useCardTilt();
  const motion = useUpgradeMotion(started);
  const before = useMemo(
    () => (fromGrade ? { ...card, ...songGradeOf(fromGrade) } : previousSongCard(card) ?? card),
    [card, fromGrade],
  );
  const cardW = Math.min(screenW * 0.66, (screenH * 0.42) / CARD_RATIO, 320);

  return (
    <RevealShell backdropUri={card.artworkUrl} motion={motion}>
      <CardUpgrade
        motion={motion}
        tilt={tilt}
        width={cardW}
        ratio={CARD_RATIO}
        radius={SONG_RADIUS}
        before={<SongCardFront card={before} width={cardW} fonts={fonts} />}
        after={<SongCardFront card={card} width={cardW} fonts={fonts} />}
        focus={songUpgradeFocus(card, cardW)}
        showcase={<SongCardShowcase card={card} width={cardW} tilt={tilt} fonts={fonts} />}
        heading={`${songTierName(card.level, card.mastered)} 카드로 강화되었어요!`}
        guide={<RevealGuide lines={[]} steps={SONG_LADDER} from={songRung(before)} current={songRung(card)} accent={card.accent} motion={motion} />}
        onDone={onClose}
      />
    </RevealShell>
  );
});

const styles = StyleSheet.create({
  guideStep: { flex: 1, paddingHorizontal: 24 },
  guideTitle: { color: SHOWROOM.fg, fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  guideStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  guideActions: { paddingTop: 24 },
});
