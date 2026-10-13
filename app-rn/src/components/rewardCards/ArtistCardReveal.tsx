import React, { useCallback, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import ArtistCardShowcase, { ArtistCardBack, ArtistCardFront } from './ArtistCardShowcase';
import CardSigner, { ShareableCard, SignableCard } from './CardSigner';
import {
  LadderStep,
  RevealGuide,
  RevealIntro,
  RevealPrimaryButton,
  RevealShell,
  RevealStep,
  revealCheer,
  useRevealBackGuard,
  useRevealMotion,
} from './CardRevealStage';
import { ARTIST_GRADE_STEPS, artistGradeStep } from './artistGrade';
import { ARTIST_CARD_RATIO, useCardFonts } from './cardTheme';
import { artistRung } from './cardKinds';
import { CardSignature } from './signature';
import { ArtistRewardCard } from './types';
import { serverTargetId } from './serverRewardCards';
import { useCardTilt } from './useCardTilt';

const ARTIST_RADIUS = 0.04;

const ARTIST_LADDER: readonly LadderStep[] = ARTIST_GRADE_STEPS.map((s) => ({
  label: s.label,
  caption: s.from === 0 ? '첫 곡 카드' : `MASTER 카드 ${s.from}장`,
}));
const ARTIST_GUIDE = ['MASTER 곡 카드를 모을수록 다음 등급 카드를 새로 받아요'];
const ARTIST_FIRST_GUIDE = [...ARTIST_GUIDE, 'BRONZE 카드부터 몇 번째 팬인지 번호가 붙어요'];
const ARTIST_LAST_GUIDE = ['이 아티스트의 마지막 등급 카드예요'];

type Step = 'reveal' | 'sign';

function artistGuide(current: number): string[] {
  if (current === 0) return ARTIST_FIRST_GUIDE;
  return current === ARTIST_LADDER.length - 1 ? ARTIST_LAST_GUIDE : ARTIST_GUIDE;
}

interface Props {
  card: ArtistRewardCard;
  /** 화면 전환이 끝나면 true. 전환과 회전이 겹치지 않게 그때 연출을 시작한다. */
  started: boolean;
  onClose: () => void;
}

/** 아티스트 카드 획득. 고를 가사가 없어 바로 서명으로 간다. */
function ArtistCardReveal({ card, started, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const fonts = useCardFonts();
  const tilt = useCardTilt();
  const motion = useRevealMotion(started);
  const sign = useRewardCardStore((s) => s.sign);
  const [step, setStep] = useState<Step>('reveal');
  const [signed, setSigned] = useState(false);

  const handleNext = useCallback(() => setStep('sign'), []);
  const handleBack = useCallback(() => setStep('reveal'), []);
  const handleSign = useCallback(
    (signature: CardSignature) => {
      sign('artist', card.id, signature);
      setSigned(true);
    },
    [card.id, sign],
  );
  useRevealBackGuard(step === 'reveal', signed, handleBack);

  const renderBack = useCallback(
    (width: number, signature: CardSignature | null, hint?: string) => (
      <ArtistCardBack card={card} width={width} fonts={fonts} signature={signature} signatureHint={hint} />
    ),
    [card, fonts],
  );
  const renderFront = useCallback((width: number) => <ArtistCardFront card={card} width={width} fonts={fonts} />, [card, fonts]);
  const signable = useMemo<SignableCard>(
    () => ({
      accent: card.accent,
      ratio: ARTIST_CARD_RATIO,
      radius: ARTIST_RADIUS,
      subject: `이 아티스트의 ${artistGradeStep(card.masteredCount).label}`,
      serialNo: card.ownerNo,
      renderBack,
      renderFront,
    }),
    [card.accent, card.ownerNo, card.masteredCount, renderBack, renderFront],
  );

  const shareId = card.issued === true ? serverTargetId(card.id) : null;
  const share = useMemo<ShareableCard | null>(
    () => (shareId == null ? null : { kind: 'artist', cardId: shareId, title: card.name, accent: card.accent, ink: card.ink }),
    [shareId, card.name, card.accent, card.ink],
  );

  // 가로 카드라 폭을 넉넉히 쓴다.
  const cardW = Math.min(screenW - 56, (screenH * 0.36) / ARTIST_CARD_RATIO, 380);
  const current = artistRung(card);

  return (
    <RevealShell backdropUri={card.imageUrl} motion={motion}>
      {step === 'reveal' ? (
        <RevealIntro
          motion={motion}
          tilt={tilt}
          accent={card.accent}
          width={cardW}
          ratio={ARTIST_CARD_RATIO}
          radius={ARTIST_RADIUS}
          front={<ArtistCardFront card={card} width={cardW} fonts={fonts} />}
          back={<ArtistCardBack card={card} width={cardW} fonts={fonts} />}
          showcase={<ArtistCardShowcase card={card} width={cardW} tilt={tilt} fonts={fonts} />}
          cheer={revealCheer(current, ARTIST_LADDER.length - 1)}
          heading={current === 0 ? '아티스트 카드를 얻었어요' : `${artistGradeStep(card.masteredCount).label} 카드를 얻었어요`}
          guide={<RevealGuide lines={artistGuide(current)} steps={ARTIST_LADDER} current={current} accent={card.accent} motion={motion} />}
          actions={<RevealPrimaryButton label="서명하기" onPress={handleNext} />}
        />
      ) : (
        <RevealStep key={step} onBack={signed ? null : handleBack}>
          <CardSigner
            card={signable}
            previewWidth={Math.min(screenW - 64, 340)}
            sealWidth={cardW}
            onSign={handleSign}
            onDone={onClose}
            share={share}
            bottomInset={insets.bottom}
          />
        </RevealStep>
      )}
    </RevealShell>
  );
}

export default React.memo(ArtistCardReveal);
