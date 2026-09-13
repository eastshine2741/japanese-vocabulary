import * as React from "react"
import { Player } from "@remotion/player"
import { END_CARD_DURATION_IN_FRAMES, PROMO_FPS, PromoReel } from "@reels/PromoReel"
import type { PromoReelData } from "@reels/types"

// Root.tsx 의 Composition 과 같은 값. 렌더와 미리보기가 같은 캔버스를 쓴다.
const COMPOSITION_WIDTH = 1080
const COMPOSITION_HEIGHT = 1920

/**
 * 서버 렌더와 같은 `PromoReel` 컴포넌트를 브라우저에서 튼다. 폰트·색공간은 mp4 와 미세하게 다를 수 있다.
 */
export const ReelPreviewPlayer = React.memo(function ReelPreviewPlayer({ data }: { data: PromoReelData }) {
  const inputProps = React.useMemo(() => ({ data }), [data])
  return (
    <Player
      acknowledgeRemotionLicense
      className="mx-auto overflow-hidden rounded-xl bg-[#111012]"
      component={PromoReel}
      compositionHeight={COMPOSITION_HEIGHT}
      compositionWidth={COMPOSITION_WIDTH}
      controls
      durationInFrames={Math.max(1, data.lyricsEndFrame) + END_CARD_DURATION_IN_FRAMES}
      fps={PROMO_FPS}
      inputProps={inputProps}
      style={{ width: "100%", aspectRatio: "9 / 16" }}
    />
  )
})
