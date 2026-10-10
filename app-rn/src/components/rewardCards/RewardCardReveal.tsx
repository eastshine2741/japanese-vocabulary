import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigate } from '../../navigation/navigationRef';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import { useStreakStore } from '../../stores/streakStore';
import CardLyricEditor from './CardLyricEditor';
import CardSigner, { SignableCard } from './CardSigner';
import {
  RevealChip,
  RevealCopy,
  RevealIntro,
  RevealPrimaryButton,
  RevealSecondaryButton,
  RevealShell,
  RevealStep,
  useRevealBackGuard,
  useRevealMotion,
} from './CardRevealStage';
import LevelPips from './LevelPips';
import SongCardShowcase, { SongCardBack, SongCardFront } from './SongCardShowcase';
import { CARD_RATIO, LEVEL_MATERIAL, useCardFonts } from './cardTheme';
import { findDummyLyrics } from './dummyRewardCards';
import { CardSignature } from './signature';
import { SongRewardCard } from './types';
import { useCardTilt } from './useCardTilt';

/** 아트를 못 받아도 이 시간 뒤엔 띄운다. */
const PREFETCH_TIMEOUT_MS = 1500;
const SONG_RADIUS = 0.046;

/**
 * 카드 획득 — 조건이 채워지면 획득 화면(RewardCardReveal 라우트)을 연다.
 * 연속 학습 축하가 떠 있으면 그 화면이 닫힐 때까지 기다린다.
 * 위에 겹쳐 그리면 아래 화면까지 매 프레임 다시 합성돼 끊기므로, 스택 화면으로 띄워 아래 화면을 떼어 낸다.
 */
export const RewardCardRevealHost = React.memo(function RewardCardRevealHost() {
  const reveal = useRewardCardStore((s) => s.reveal);
  const imageUrl = useRewardCardStore((s) =>
    s.reveal?.kind === 'song'
      ? s.songCards.find((c) => c.id === s.reveal?.cardId)?.artworkUrl
      : s.artistCards.find((c) => c.id === s.reveal?.cardId)?.imageUrl,
  );
  const streakShowing = useStreakStore((s) => s.celebration !== null);

  useEffect(() => {
    if (!reveal || streakShowing) return;
    let pending = true;
    const open = () => {
      if (!pending) return;
      pending = false;
      useRewardCardStore.getState().dismissReveal();
      navigate('RewardCardReveal', reveal);
    };
    // 회전 도중 아트가 늦게 받아져 튀어나오지 않도록 미리 받아 둔다.
    const timer = setTimeout(open, PREFETCH_TIMEOUT_MS);
    if (imageUrl) Image.prefetch(imageUrl).then(open, open);
    else open();
    return () => {
      pending = false;
      clearTimeout(timer);
    };
  }, [reveal, imageUrl, streakShowing]);

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
  const motion = useRevealMotion(started);
  const lines = useMemo(() => findDummyLyrics(card.id), [card.id]);
  const setLyric = useRewardCardStore((s) => s.setLyric);
  const sign = useRewardCardStore((s) => s.sign);
  const [step, setStep] = useState<Step>('reveal');
  // 서명 단계에서 뒤로 가면 들어온 단계로 돌아간다.
  const [signFrom, setSignFrom] = useState<'reveal' | 'pick'>('reveal');
  const [signed, setSigned] = useState(false);

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
      sign('song', card.id, signature);
      setSigned(true);
    },
    [card.id, sign],
  );
  useRevealBackGuard(step === 'reveal', signed, handleBack);

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
      serialNo: card.ownerNo,
      issuedAt: card.earnedAt,
      renderBack,
      renderFront,
    }),
    [card.accent, card.ownerNo, card.earnedAt, renderBack, renderFront],
  );

  const cardW = Math.min(screenW * 0.66, (screenH * 0.46) / CARD_RATIO, 320);
  const material = LEVEL_MATERIAL[card.level];

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
          eyebrow={
            <RevealChip colors={material.frame} textColor={material.chipText} label="새 곡 카드">
              <LevelPips level={card.level} color={material.chipText} size={5} />
            </RevealChip>
          }
          copy={<RevealCopy title={card.title} titleFont={fonts.jpHeavy} subtitle={card.artist} accent={card.accent} />}
          actions={
            <>
              <RevealPrimaryButton label="가사 고르기" onPress={handlePick} />
              <RevealSecondaryButton label="이대로 받기" onPress={handleKeep} />
            </>
          }
        />
      ) : (
        <RevealStep key={step} onBack={signed ? null : handleBack}>
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
              card={signable}
              fonts={fonts}
              previewWidth={Math.min(screenW * 0.42, 190)}
              sealWidth={cardW}
              onSign={handleSign}
              onDone={onClose}
              bottomInset={insets.bottom}
            />
          )}
        </RevealStep>
      )}
    </RevealShell>
  );
});
