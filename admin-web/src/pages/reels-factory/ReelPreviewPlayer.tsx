import * as React from "react"
import { Player, type PlayerRef } from "@remotion/player"
import { END_CARD_DURATION_IN_FRAMES, PROMO_FPS, PromoReel } from "@reels/PromoReel"
import type { PromoReelData } from "@reels/types"

// Root.tsx 의 Composition 과 같은 값. 렌더와 미리보기가 같은 캔버스를 쓴다.
const COMPOSITION_WIDTH = 1080
const COMPOSITION_HEIGHT = 1920

/**
 * 서버 렌더와 같은 `PromoReel` 컴포넌트를 브라우저에서 튼다. 폰트·색공간은 mp4 와 미세하게 다를 수 있다.
 * 재생·탐색은 에디터 트랜스포트가 ref 로 조작하므로 Player 자체 컨트롤은 끈다.
 */
export const ReelPreviewPlayer = React.memo(
  React.forwardRef<PlayerRef, { data: PromoReelData }>(function ReelPreviewPlayer({ data }, ref) {
    const inputProps = React.useMemo(() => ({ data }), [data])
    return (
      <Player
        acknowledgeRemotionLicense
        clickToPlay={false}
        component={PromoReel}
        compositionHeight={COMPOSITION_HEIGHT}
        compositionWidth={COMPOSITION_WIDTH}
        durationInFrames={Math.max(1, data.lyricsEndFrame) + END_CARD_DURATION_IN_FRAMES}
        fps={PROMO_FPS}
        inputProps={inputProps}
        ref={ref}
        style={{ width: "100%", height: "100%" }}
      />
    )
  }),
)
