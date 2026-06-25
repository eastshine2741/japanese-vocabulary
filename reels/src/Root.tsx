import {Composition} from 'remotion';

import {PromoReel, PROMO_DURATION_IN_FRAMES, PROMO_FPS} from './PromoReel';
import {samplePreviewPromo} from './data/samplePreview';
import type {PromoReelData} from './types';

export const RemotionRoot = () => {
  return (
    <Composition
      component={PromoReel}
      defaultProps={{data: samplePreviewPromo} satisfies {data: PromoReelData}}
      durationInFrames={PROMO_DURATION_IN_FRAMES}
      fps={PROMO_FPS}
      height={1920}
      id="PromoReel"
      width={1080}
    />
  );
};
