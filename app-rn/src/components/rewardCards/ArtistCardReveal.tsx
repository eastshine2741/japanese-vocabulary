import React, { useCallback, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import ArtistCardShowcase, { ArtistCardBack, ArtistCardFront } from './ArtistCardShowcase';
import CardSigner, { SignableCard } from './CardSigner';
import {
  RevealChip,
  RevealCopy,
  RevealIntro,
  RevealPrimaryButton,
  RevealShell,
  RevealStep,
  useRevealBackGuard,
  useRevealMotion,
} from './CardRevealStage';
import { artistGradeStep } from './artistGrade';
import { ARTIST_CARD_RATIO, ARTIST_MATERIAL, useCardFonts } from './cardTheme';
import { CardSignature } from './signature';
import { ArtistRewardCard } from './types';
import { useCardTilt } from './useCardTilt';

const ARTIST_RADIUS = 0.04;

type Step = 'reveal' | 'sign';

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
      serialNo: card.fanNo,
      issuedAt: card.since,
      renderBack,
      renderFront,
    }),
    [card.accent, card.fanNo, card.since, renderBack, renderFront],
  );

  // 가로 카드라 폭을 넉넉히 쓴다.
  const cardW = Math.min(screenW - 56, (screenH * 0.36) / ARTIST_CARD_RATIO, 380);
  const grade = artistGradeStep(card.masteredCount);
  const material = ARTIST_MATERIAL[grade.grade];

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
          eyebrow={<RevealChip colors={material.frame} textColor={material.chipText} label="새 아티스트 카드" />}
          copy={
            <RevealCopy
              title={card.name}
              titleFont={fonts.jpHeavy}
              subtitle={`${card.fanNo.toLocaleString('ko-KR')}번째 팬`}
              accent={card.accent}
            />
          }
          actions={<RevealPrimaryButton label="서명하기" onPress={handleNext} />}
        />
      ) : (
        <RevealStep key={step} onBack={signed ? null : handleBack}>
          <CardSigner
            card={signable}
            fonts={fonts}
            previewWidth={Math.min(screenW - 64, 340)}
            sealWidth={cardW}
            onSign={handleSign}
            onDone={onClose}
            bottomInset={insets.bottom}
          />
        </RevealStep>
      )}
    </RevealShell>
  );
}

export default React.memo(ArtistCardReveal);
