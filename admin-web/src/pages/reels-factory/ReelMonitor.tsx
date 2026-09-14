import * as React from "react"
import type { PlayerRef } from "@remotion/player"
import { Film, Loader2, Pause, Play, Upload } from "lucide-react"
import type { PromoReelData } from "@reels/types"
import { LoadingState } from "@/components/StateViews"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatMs, frameToMs, msToFrame } from "./reelEditor"

// Remotion Player 는 무거워서 미리보기를 처음 열 때만 내려받는다.
const ReelPreviewPlayer = React.lazy(() =>
  import("./ReelPreviewPlayer").then((module) => ({ default: module.ReelPreviewPlayer })),
)

export type MonitorMode = "source" | "reel"

export type MonitorHandle = {
  /** 현재 모니터를 이 시각(MV 절대 ms)으로 옮긴다. */
  seek(ms: number): void
  togglePlay(): void
  pause(): void
}

type Props = {
  mode: MonitorMode
  onModeChange(mode: MonitorMode): void
  /** 서버 캐시의 MV 스트림. 없으면 아직 안 올린 것. */
  mvUrl: string | null
  /** 업로드 진행률 0..1. 올리는 중이 아니면 null. */
  uploadProgress: number | null
  canUploadSource: boolean
  onUploadSource(file: File): void
  /** 어드민이 MV 를 어디서 받을지 찾아가는 링크. */
  youtubeUrl: string | null
  data: PromoReelData | null
  sourceStartMs: number
  fps: number
  playheadMs: number
  onPlayhead(ms: number): void
  onDuration(ms: number): void
}

/**
 * Source 는 MV 원본을 그대로 틀어 구간을 찾는 용도, Reel 은 편집 결과를 PromoReel 로 트는 용도다.
 * 둘 다 같은 플레이헤드(MV 절대 시각)를 공유하고 모드를 바꾸면 그 시각으로 따라간다.
 */
export const ReelMonitor = React.forwardRef<MonitorHandle, Props>(function ReelMonitor(
  { mode, onModeChange, mvUrl, uploadProgress, canUploadSource, onUploadSource, youtubeUrl, data, sourceStartMs, fps, playheadMs, onPlayhead, onDuration },
  ref,
) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const playerRef = React.useRef<PlayerRef | null>(null)
  const [player, setPlayer] = React.useState<PlayerRef | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const playheadRef = React.useRef(playheadMs)
  playheadRef.current = playheadMs
  const sourceStartRef = React.useRef(sourceStartMs)
  sourceStartRef.current = sourceStartMs
  const modeRef = React.useRef(mode)
  modeRef.current = mode

  const attachPlayer = React.useCallback((instance: PlayerRef | null) => {
    playerRef.current = instance
    setPlayer(instance)
  }, [])

  const seekReel = React.useCallback(
    (ms: number) => playerRef.current?.seekTo(Math.max(0, msToFrame(ms - sourceStartRef.current, fps))),
    [fps],
  )

  React.useImperativeHandle(
    ref,
    () => ({
      seek(ms) {
        if (mode === "source") {
          if (videoRef.current) videoRef.current.currentTime = ms / 1000
        } else {
          seekReel(ms)
        }
        onPlayhead(ms)
      },
      togglePlay() {
        if (mode === "source") {
          const video = videoRef.current
          if (!video) return
          if (video.paused) void video.play()
          else video.pause()
        } else {
          playerRef.current?.toggle()
        }
      },
      pause() {
        videoRef.current?.pause()
        playerRef.current?.pause()
      },
    }),
    [mode, onPlayhead, seekReel],
  )

  // 모드를 바꾸면 이전 모니터를 멈추고 새 모니터를 같은 시각으로 옮긴다.
  React.useEffect(() => {
    videoRef.current?.pause()
    playerRef.current?.pause()
    setPlaying(false)
    if (mode === "source") {
      if (videoRef.current) videoRef.current.currentTime = playheadRef.current / 1000
    } else {
      seekReel(playheadRef.current)
    }
  }, [mode, seekReel])

  // Player 가 처음 뜨면(줄을 처음 골랐을 때) 플레이헤드 자리로 맞춰 둔다. Source 재생은 건드리지 않는다.
  React.useEffect(() => {
    if (player) seekReel(playheadRef.current)
  }, [player, seekReel])

  React.useEffect(() => {
    if (!player) return
    // 숨겨진 Player 가 props 변경으로 내는 frameupdate 가 Source 플레이헤드를 흔들면 안 된다.
    const onFrame = ({ detail }: { detail: { frame: number } }) => {
      if (modeRef.current === "reel") onPlayhead(sourceStartRef.current + frameToMs(detail.frame, fps))
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    player.addEventListener("frameupdate", onFrame)
    player.addEventListener("play", onPlay)
    player.addEventListener("pause", onPause)
    player.addEventListener("ended", onPause)
    return () => {
      player.removeEventListener("frameupdate", onFrame)
      player.removeEventListener("play", onPlay)
      player.removeEventListener("pause", onPause)
      player.removeEventListener("ended", onPause)
    }
  }, [fps, onPlayhead, player])

  // <video> 의 timeupdate 는 초당 4번뿐이라 재생 중엔 프레임마다 읽는다.
  React.useEffect(() => {
    if (mode !== "source" || !playing) return
    let handle = 0
    const tick = () => {
      if (videoRef.current) onPlayhead(videoRef.current.currentTime * 1000)
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [mode, onPlayhead, playing])

  const reelReady = mvUrl != null && data != null && data.lyricLines.length > 0
  const reelLocalMs = Math.max(0, playheadMs - sourceStartMs)

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-[#d9e1ea] bg-[#111012] text-[#f8fafc]">
      <div className="flex items-center justify-between border-b border-white/10 px-2 py-1.5">
        <div className="flex gap-1" role="tablist">
          <ModeTab active={mode === "source"} label="Source MV" onClick={() => onModeChange("source")} />
          <ModeTab active={mode === "reel"} label="Reel" onClick={() => onModeChange("reel")} />
        </div>
        <span className="text-[11px] text-white/60">
          {mvUrl == null ? "MV 없음" : mode === "reel" && !reelReady ? "줄을 고르면 미리보기가 뜹니다" : "1080×1920 · 30fps"}
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        {mvUrl == null ? (
          <div className="flex flex-col items-center gap-3 text-center text-sm text-white/70">
            <Film className="h-8 w-8 text-white/40" />
            <p>MV mp4 를 올려야 구간을 찾고 미리볼 수 있습니다.</p>
            <input
              accept="video/mp4,.mp4"
              aria-label="MV mp4 file"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ""
                if (file) onUploadSource(file)
              }}
              ref={fileInputRef}
              type="file"
            />
            <Button
              disabled={!canUploadSource || uploadProgress != null}
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="secondary"
            >
              {uploadProgress != null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadProgress == null
                ? "MV mp4 올리기"
                : uploadProgress >= 1
                  ? "미리보기 만드는 중..."
                  : `MV 올리는 중... ${Math.round(uploadProgress * 100)}%`}
            </Button>
            {youtubeUrl ? (
              <a className="text-xs text-white/50 underline-offset-2 hover:underline" href={youtubeUrl} rel="noreferrer" target="_blank">
                YouTube 에서 열기
              </a>
            ) : null}
          </div>
        ) : null}
        {mvUrl != null ? (
          <video
            aria-label="Source MV"
            className={cn("max-h-full max-w-full rounded", mode !== "source" && "hidden")}
            onLoadedMetadata={(event) => onDuration(event.currentTarget.duration * 1000)}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onSeeked={(event) => {
              if (modeRef.current === "source") onPlayhead(event.currentTarget.currentTime * 1000)
            }}
            playsInline
            preload="metadata"
            ref={videoRef}
            src={mvUrl}
          />
        ) : null}
        {mvUrl != null && data != null ? (
          <div className={cn("h-full max-w-full overflow-hidden rounded-xl bg-black", mode !== "reel" && "hidden")} style={{ aspectRatio: "9 / 16" }}>
            {reelReady ? (
              <React.Suspense fallback={<LoadingState />}>
                <ReelPreviewPlayer data={data} ref={attachPlayer} />
              </React.Suspense>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 border-t border-white/10 px-2 py-1.5">
        <button
          aria-label={playing ? "Pause" : "Play"}
          className="focus-ring flex h-8 w-8 items-center justify-center rounded-md text-white hover:bg-white/10 disabled:opacity-40"
          disabled={mvUrl == null || (mode === "reel" && !reelReady)}
          onClick={() => {
            if (mode === "source") {
              const video = videoRef.current
              if (!video) return
              if (video.paused) void video.play()
              else video.pause()
            } else {
              playerRef.current?.toggle()
            }
          }}
          type="button"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <span className="font-mono text-sm tabular-nums">{formatMs(playheadMs)}</span>
        {mode === "reel" ? <span className="font-mono text-xs text-white/60">reel {formatMs(reelLocalMs)}</span> : null}
        <span className="ml-auto text-[11px] text-white/50">Space 재생 · M 줄 시작 찍기 · I/O 클립 시작·끝 · ←→ 프레임</span>
      </div>
    </div>
  )
})

function ModeTab({ active, label, onClick }: { active: boolean; label: string; onClick(): void }) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "focus-ring rounded-md px-2.5 py-1 text-xs font-semibold",
        active ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white",
      )}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
    </button>
  )
}
