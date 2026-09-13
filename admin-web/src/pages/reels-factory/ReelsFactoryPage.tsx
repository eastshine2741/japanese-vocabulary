import * as React from "react"
import { Download, Loader2 } from "lucide-react"
import { adminApi, ApiError, apiUrl } from "@/api/client"
import type { ReelsSongDetail } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/StateViews"
import { useAuth } from "@/features/auth"
import { LineBin } from "./LineBin"
import { LineInspector } from "./LineInspector"
import { ReelMonitor, type MonitorHandle, type MonitorMode } from "./ReelMonitor"
import { ReelTimeline } from "./ReelTimeline"
import { SongPicker } from "./SongPicker"
import {
  buildPromoData,
  emptyEditor,
  frameToMs,
  setEnd,
  setLineStart,
  setLinesIncluded,
  setSourceStart,
  shiftAll,
  toggleLine,
  toggleToken,
  validate,
} from "./reelEditor"

/**
 * 릴스 에디터. 툴바 / 줄 목록 · 모니터 · 인스펙터 / 타임라인 의 NLE 배치다.
 * 편집 상태(클립 구간·줄 타이밍·단어)는 브라우저에만 있고, 렌더 요청에 PromoReel props 로 그대로 실린다.
 */
export function ReelsFactoryPage() {
  const { token } = useAuth()
  const [selectedSongId, setSelectedSongId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<ReelsSongDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = React.useState(false)
  const [editor, setEditor] = React.useState(emptyEditor)
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
  const [mvUrl, setMvUrl] = React.useState<string | null>(null)
  const [mvDurationMs, setMvDurationMs] = React.useState<number | null>(null)
  /** 업로드 진행률 0..1. 올리는 중이 아니면 null. */
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [rendering, setRendering] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<MonitorMode>("source")
  const [playheadMs, setPlayheadMs] = React.useState(0)
  // 키 핸들러가 재생 중 프레임마다 다시 붙지 않도록 플레이헤드는 ref 로 읽는다.
  const playheadRef = React.useRef(0)
  playheadRef.current = playheadMs
  const monitorRef = React.useRef<MonitorHandle>(null)

  React.useEffect(() => {
    if (!token || selectedSongId == null) return
    let cancelled = false
    setLoadingDetail(true)
    setDetail(null)
    setEditor(emptyEditor())
    setSelectedIndex(null)
    setMvUrl(null)
    setMvDurationMs(null)
    setMode("source")
    setPlayheadMs(0)
    setError(null)
    // 이전에 올린 MV 가 서버에 남아 있으면 다시 올리지 않아도 되게 같이 확인한다.
    Promise.all([adminApi.reelsSong(token, selectedSongId), adminApi.reelsCachedSource(token, selectedSongId)])
      .then(([nextDetail, source]) => {
        if (cancelled) return
        setDetail(nextDetail)
        if (source) setMvUrl(apiUrl(source.mvPath))
      })
      .catch((cause) => {
        if (!cancelled) setError(errorLabel(cause))
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedSongId, token])

  const errors = React.useMemo(() => (detail ? validate(editor, detail) : []), [detail, editor])
  const data = React.useMemo(
    () => (detail && editor.lines.length > 0 ? buildPromoData(detail, editor, mvUrl ?? "") : null),
    [detail, editor, mvUrl],
  )
  const fps = detail?.fps ?? 30
  const inputReady = Boolean(detail?.song.renderEligible) && errors.length === 0
  // 서버는 올려 둔 MV 로만 렌더한다.
  const canRender = inputReady && mvUrl != null && !rendering

  // ── 편집 ──────────────────────────────────────────────────────────────────

  const handleToggleLine = React.useCallback(
    (index: number) => {
      if (!detail) return
      setEditor((current) => toggleLine(current, detail, index))
      setSelectedIndex(index)
    },
    [detail],
  )
  const handleSetLinesIncluded = React.useCallback(
    (indexes: number[], included: boolean) => {
      if (!detail) return
      setEditor((current) => setLinesIncluded(current, detail, indexes, included))
    },
    [detail],
  )
  const handleClearLines = React.useCallback(() => setEditor(emptyEditor()), [])
  const handleSetLineStart = React.useCallback(
    (index: number, ms: number) => {
      if (!detail) return
      setEditor((current) => setLineStart(current, detail, index, ms))
    },
    [detail],
  )
  const handleToggleToken = React.useCallback(
    (index: number, tokenIndex: number) => {
      if (!detail) return
      setEditor((current) => toggleToken(current, index, tokenIndex, detail.maxVocabularyPerLine))
    },
    [detail],
  )
  const handleSetSourceStart = React.useCallback((ms: number) => setEditor((current) => setSourceStart(current, ms)), [])
  const handleSetEnd = React.useCallback((ms: number) => setEditor((current) => setEnd(current, ms)), [])
  const handleMoveClip = React.useCallback(
    (sourceStartMs: number) => setEditor((current) => shiftAll(current, sourceStartMs - current.sourceStartMs)),
    [],
  )

  // ── 트랜스포트 ─────────────────────────────────────────────────────────────

  // 모드가 바뀌면 모니터의 모드 효과가 새 플레이헤드로 따라가고, 같은 모드면 여기서 바로 seek 한다.
  const seekSource = React.useCallback((ms: number) => {
    setMode("source")
    setPlayheadMs(ms)
    monitorRef.current?.seek(ms)
  }, [])
  const seekReel = React.useCallback((ms: number) => {
    setMode("reel")
    setPlayheadMs(ms)
    monitorRef.current?.seek(ms)
  }, [])
  const seekCurrent = React.useCallback((ms: number) => {
    setPlayheadMs(ms)
    monitorRef.current?.seek(ms)
  }, [])

  /** 플레이헤드에 줄 시작을 찍고 다음 줄로 넘어간다. PLAIN 가사를 들으면서 찍는 흐름이다. */
  const markSelectedLine = React.useCallback(() => {
    if (!detail || selectedIndex == null) return
    const position = editor.lines.findIndex((line) => line.index === selectedIndex)
    if (position < 0) return
    handleSetLineStart(selectedIndex, playheadRef.current)
    const next = editor.lines[position + 1]
    if (next) setSelectedIndex(next.index)
  }, [detail, editor.lines, handleSetLineStart, selectedIndex])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      switch (event.key) {
        case " ":
          event.preventDefault()
          monitorRef.current?.togglePlay()
          break
        case "m":
        case "M":
          markSelectedLine()
          break
        case "i":
        case "I":
          handleSetSourceStart(playheadRef.current)
          break
        case "o":
        case "O":
          handleSetEnd(playheadRef.current)
          break
        case "ArrowLeft":
        case "ArrowRight": {
          event.preventDefault()
          const step = event.shiftKey ? 1000 : frameToMs(1, fps)
          seekCurrent(Math.max(0, playheadRef.current + (event.key === "ArrowLeft" ? -step : step)))
          break
        }
        default:
          break
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [fps, handleSetEnd, handleSetSourceStart, markSelectedLine, seekCurrent])

  // ── 서버 ───────────────────────────────────────────────────────────────────

  async function uploadSource(file: File) {
    if (!token || !detail) return
    setUploadProgress(0)
    setError(null)
    try {
      const source = await adminApi.reelsUploadSource(token, detail.song.id, file, setUploadProgress)
      setMvUrl(apiUrl(source.mvPath))
    } catch (cause) {
      setError(errorLabel(cause))
    } finally {
      setUploadProgress(null)
    }
  }

  async function renderReel() {
    if (!token || !detail || !data) return
    setRendering(true)
    setError(null)
    monitorRef.current?.pause()
    try {
      const blob = await adminApi.renderReel(token, {
        songId: detail.song.id,
        data: { ...data, song: { ...data.song, mvAsset: "" } },
        acknowledgeSourceRightsAndPlatformRisk: true,
      })
      downloadBlob(blob, `${detail.song.artist}-${detail.song.title}-kotonoha-reel.mp4`)
    } catch (cause) {
      setError(errorLabel(cause))
    } finally {
      setRendering(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px-40px)] min-h-[640px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-[#18212f]">Reels Factory</h1>
        <SongPicker selectedSongId={selectedSongId} onSelect={setSelectedSongId} onError={setError} />
        {detail ? (
          <>
            <Badge tone={detail.song.renderEligible ? "success" : "warning"}>
              {detail.song.renderEligible ? "eligible" : (detail.song.ineligibleReason ?? "ineligible")}
            </Badge>
            <Badge tone={detail.lyricType === "SYNCED" ? "neutral" : "warning"}>{detail.lyricType}</Badge>
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          <Button disabled={!canRender} onClick={renderReel} type="button">
            {rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {rendering ? "Rendering..." : "Render and download MP4"}
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-sm text-[#991b1b]">{error}</div> : null}

      {loadingDetail ? (
        <LoadingState />
      ) : detail ? (
        <>
          <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
            <LineBin
              detail={detail}
              editor={editor}
              selectedIndex={selectedIndex}
              onClear={handleClearLines}
              onSelect={setSelectedIndex}
              onSetIncluded={handleSetLinesIncluded}
            />
            <ReelMonitor
              canUploadSource={detail.song.renderEligible}
              data={data}
              fps={fps}
              mode={mode}
              mvUrl={mvUrl}
              onDuration={setMvDurationMs}
              onModeChange={setMode}
              onUploadSource={uploadSource}
              onPlayhead={setPlayheadMs}
              playheadMs={playheadMs}
              ref={monitorRef}
              sourceStartMs={editor.sourceStartMs}
              uploadProgress={uploadProgress}
              youtubeUrl={detail.song.youtubeUrl}
            />
            <LineInspector
              detail={detail}
              editor={editor}
              errors={errors}
              playheadMs={playheadMs}
              selectedIndex={selectedIndex}
              onSeekReel={seekReel}
              onSetEnd={handleSetEnd}
              onSetLineStart={handleSetLineStart}
              onSetSourceStart={handleSetSourceStart}
              onToggleLine={handleToggleLine}
              onToggleToken={handleToggleToken}
            />
          </div>
          <div className="h-[200px] shrink-0">
            <ReelTimeline
              detail={detail}
              editor={editor}
              mvDurationMs={mvDurationMs ?? (detail.song.durationSeconds ?? 0) * 1000}
              playheadMs={playheadMs}
              selectedIndex={selectedIndex}
              onMoveClip={handleMoveClip}
              onSeekReel={seekReel}
              onSeekSource={seekSource}
              onSelectLine={setSelectedIndex}
              onSetEnd={handleSetEnd}
              onSetLineStart={handleSetLineStart}
              onSetSourceStart={handleSetSourceStart}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[#cbd5e1] text-sm text-[#637083]">
          곡을 고르면 에디터가 열립니다.
        </div>
      )}
    </div>
  )
}

function errorLabel(cause: unknown) {
  if (cause instanceof ApiError) return `${cause.status}: ${cause.message}`
  return cause instanceof Error ? cause.message : "Request failed"
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
