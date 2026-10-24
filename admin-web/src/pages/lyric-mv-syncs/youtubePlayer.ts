import * as React from "react"

type YoutubePlayer = {
  getCurrentTime(): number
  getPlayerState(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  destroy(): void
}

type YoutubeApi = {
  Player: new (element: HTMLElement, options: { videoId: string; playerVars?: Record<string, number>; events?: { onReady?: () => void } }) => YoutubePlayer
}

declare global {
  interface Window {
    YT?: YoutubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

const PLAYING = 1
let apiLoading: Promise<YoutubeApi> | null = null

function loadYoutubeApi(): Promise<YoutubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiLoading ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT!)
    }
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(script)
  })
  return apiLoading
}

/** 앱처럼 MV 를 YouTube 임베드로 틀고 재생 위치를 ms 로 돌려준다. */
export function useYoutubePlayer(videoId: string) {
  const hostRef = React.useRef<HTMLDivElement>(null)
  const playerRef = React.useRef<YoutubePlayer | null>(null)
  const [ready, setReady] = React.useState(false)
  const [timeMs, setTimeMs] = React.useState(0)

  React.useEffect(() => {
    let alive = true
    const mount = document.createElement("div")
    hostRef.current?.appendChild(mount)
    loadYoutubeApi().then((api) => {
      if (!alive) return
      playerRef.current = new api.Player(mount, {
        videoId,
        playerVars: { playsinline: 1, rel: 0 },
        events: { onReady: () => alive && setReady(true) },
      })
    })
    return () => {
      alive = false
      playerRef.current?.destroy()
      playerRef.current = null
      setReady(false)
      mount.remove()
    }
  }, [videoId])

  React.useEffect(() => {
    if (!ready) return
    const timer = window.setInterval(() => {
      const player = playerRef.current
      if (player) setTimeMs(Math.round(player.getCurrentTime() * 1000))
    }, 50)
    return () => window.clearInterval(timer)
  }, [ready])

  const seek = React.useCallback((ms: number) => {
    const player = playerRef.current
    if (!player) return
    player.seekTo(Math.max(0, ms) / 1000, true)
    player.playVideo()
    setTimeMs(Math.max(0, ms))
  }, [])

  const toggle = React.useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (player.getPlayerState() === PLAYING) player.pauseVideo()
    else player.playVideo()
  }, [])

  return { hostRef, ready, timeMs, seek, toggle }
}
