import {Composition} from 'remotion';

import {END_CARD_DURATION_IN_FRAMES, PROMO_FPS, PROMO_HEIGHT, PROMO_WIDTH, PromoReel} from './PromoReel';
import {samplePreviewPromo} from './data/samplePreview';
import type {PromoReelData} from './types';

type PromoReelProps = {data: PromoReelData};

// 릴스 길이는 고른 가사 구간에 따라 다르다. 마지막 줄이 끝나는 프레임 뒤에 엔드카드를 붙인다.
const calculateMetadata = ({props}: {props: PromoReelProps}) => ({
  durationInFrames: Math.max(1, props.data.lyricsEndFrame) + END_CARD_DURATION_IN_FRAMES,
});

export const RemotionRoot = () => {
  return (
    <Composition
      calculateMetadata={calculateMetadata}
      component={PromoReel}
      defaultProps={{data: samplePreviewPromo} satisfies PromoReelProps}
      durationInFrames={samplePreviewPromo.lyricsEndFrame + END_CARD_DURATION_IN_FRAMES}
      fps={PROMO_FPS}
      height={PROMO_HEIGHT}
      id="PromoReel"
      width={PROMO_WIDTH}
    />
  );
};
