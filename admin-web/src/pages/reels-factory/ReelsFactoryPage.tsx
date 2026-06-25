import * as React from "react"
import { AlertTriangle, Download, Search } from "lucide-react"
import { adminApi, ApiError } from "@/api/client"
import type { ReelsLyricLine, ReelsSongCandidate, ReelsSongDetail } from "@/api/types"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { useAuth } from "@/features/auth"
import { cn } from "@/lib/utils"

export function ReelsFactoryPage() {
  const { token } = useAuth()
  const [query, setQuery] = React.useState("")
  const [songs, setSongs] = React.useState<ReelsSongCandidate[]>([])
  const [selectedSongId, setSelectedSongId] = React.useState<number | null>(null)
  const [detail, setDetail] = React.useState<ReelsSongDetail | null>(null)
  const [selectedLines, setSelectedLines] = React.useState<number[]>([])
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [loadingSongs, setLoadingSongs] = React.useState(true)
  const [loadingDetail, setLoadingDetail] = React.useState(false)
  const [rendering, setRendering] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoadingSongs(true)
    adminApi
      .reelsSongs(token, 0, query)
      .then((page) => {
        if (cancelled) return
        setSongs(page.content)
        if (!selectedSongId && page.content[0]) setSelectedSongId(page.content[0].id)
      })
      .catch((cause) => {
        if (!cancelled) setError(errorLabel(cause))
      })
      .finally(() => {
        if (!cancelled) setLoadingSongs(false)
      })
    return () => {
      cancelled = true
    }
  }, [query, selectedSongId, token])

  React.useEffect(() => {
    if (!token || selectedSongId == null) return
    let cancelled = false
    setLoadingDetail(true)
    setSelectedLines([])
    setAcknowledged(false)
    adminApi
      .reelsSong(token, selectedSongId)
      .then((nextDetail) => {
        if (!cancelled) setDetail(nextDetail)
      })
      .catch((cause) => {
        if (!cancelled) {
          setDetail(null)
          setError(errorLabel(cause))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedSongId, token])

  const canRender =
    Boolean(detail?.song.renderEligible) &&
    selectedLines.length >= (detail?.minLineCount ?? 4) &&
    selectedLines.length <= (detail?.maxLineCount ?? 6) &&
    acknowledged &&
    !rendering

  async function renderReel() {
    if (!token || !detail) return
    setRendering(true)
    setError(null)
    try {
      const blob = await adminApi.renderReel(token, {
        songId: detail.song.id,
        lineIndexes: selectedLines,
        acknowledgeSourceRightsAndPlatformRisk: acknowledged,
      })
      downloadBlob(blob, `${detail.song.artist}-${detail.song.title}-kotonoha-reel.mp4`)
    } catch (cause) {
      setError(errorLabel(cause))
    } finally {
      setRendering(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reels Factory"
        meta="분석 완료 곡에서 4–6개 lyric line을 골라 Remotion MP4를 직접 생성하고 다운로드합니다."
      />

      {error ? <ErrorState label={error} /> : null}

      <section className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-[#d9e1ea] bg-white">
          <div className="border-b border-[#e2e8f0] p-3">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#637083]" htmlFor="reels-song-search">
              Song search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#7b8798]" />
              <Input
                id="reels-song-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder="title or artist"
              />
            </div>
          </div>
          {loadingSongs ? (
            <LoadingState />
          ) : (
            <div className="max-h-[680px] overflow-auto p-2">
              {songs.map((song) => (
                <button
                  className={cn(
                    "mb-2 w-full rounded-md border p-3 text-left text-sm transition-colors",
                    song.id === selectedSongId
                      ? "border-[#0f766e] bg-[#e6fffb]"
                      : "border-[#e2e8f0] bg-white hover:bg-[#f8fafc]",
                  )}
                  key={song.id}
                  onClick={() => setSelectedSongId(song.id)}
                  type="button"
                >
                  <div className="font-semibold text-[#18212f]">{song.title}</div>
                  <div className="mt-0.5 text-xs text-[#637083]">{song.artist}</div>
                  <div className="mt-2">
                    {song.renderEligible ? (
                      <Badge tone="success">eligible</Badge>
                    ) : (
                      <Badge tone="warning">{song.ineligibleReason ?? "ineligible"}</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[#d9e1ea] bg-white">
          {loadingDetail ? (
            <LoadingState />
          ) : detail ? (
            <>
              <div className="border-b border-[#e2e8f0] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[#18212f]">
                      {detail.song.title} <span className="text-[#637083]">/ {detail.song.artist}</span>
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-[#0f766e]">{detail.headline}</p>
                  </div>
                  <Badge tone={detail.song.renderEligible ? "success" : "warning"}>
                    {selectedLines.length}/{detail.minLineCount}–{detail.maxLineCount} lines
                  </Badge>
                </div>
              </div>
              <div className="max-h-[720px] divide-y divide-[#e2e8f0] overflow-auto">
                {detail.lines.map((line) => (
                  <LyricLinePicker
                    key={line.index}
                    line={line}
                    checked={selectedLines.includes(line.index)}
                    disabled={!line.selectable || selectedLines.length >= detail.maxLineCount && !selectedLines.includes(line.index)}
                    onChange={(checked) => {
                      setSelectedLines((current) =>
                        checked
                          ? [...current, line.index].sort((a, b) => a - b)
                          : current.filter((index) => index !== line.index),
                      )
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="p-4 text-sm text-[#637083]">Select a song to inspect analyzed lyric lines.</div>
          )}
        </div>

        <aside className="space-y-4 rounded-lg border border-[#d9e1ea] bg-white p-4">
          <div className="mx-auto flex aspect-[9/16] w-40 items-center justify-center rounded-xl border border-dashed border-[#94a3b8] bg-[#111012] p-4 text-center text-xs font-semibold text-[#f8fafc]">
            9:16 Remotion Preview
          </div>
          <div>
            <div className="text-sm font-semibold text-[#18212f]">Download-only MVP</div>
            <p className="mt-1 text-xs leading-5 text-[#637083]">
              작업 기록과 파일 보관은 없습니다. 브라우저를 닫거나 render가 실패하면 다시 선택해야 합니다.
            </p>
          </div>
          <label className="flex items-start gap-2 rounded-md border border-[#facc15] bg-[#fefce8] p-3 text-xs leading-5 text-[#713f12]">
            <input
              aria-label="Acknowledge source rights and platform risk"
              className="mt-1"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              type="checkbox"
            />
            <span>
              YouTube source extraction and promotional upload may be constrained by rights and platform policy. I acknowledge this admin-only risk.
            </span>
          </label>
          <Button className="w-full" disabled={!canRender} onClick={renderReel}>
            <Download className="h-4 w-4" />
            {rendering ? "Rendering..." : "Render and download MP4"}
          </Button>
          {!detail?.song.renderEligible ? (
            <div className="flex gap-2 rounded-md bg-[#fff1f2] p-3 text-xs text-[#991b1b]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {detail?.song.ineligibleReason ?? "Select an eligible song."}
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  )
}

function LyricLinePicker({
  line,
  checked,
  disabled,
  onChange,
}: {
  line: ReelsLyricLine
  checked: boolean
  disabled: boolean
  onChange(checked: boolean): void
}) {
  return (
    <label className={cn("block p-4", disabled && !checked ? "opacity-50" : "hover:bg-[#f8fafc]")}>
      <div className="flex gap-3">
        <input
          aria-label={`Select lyric line ${line.index}`}
          checked={checked}
          disabled={disabled && !checked}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[#637083]">#{line.index}</span>
            <span className="text-xs text-[#637083]">{formatMs(line.startTimeMs)}</span>
            {!line.selectable ? <Badge tone="warning">{line.ineligibleReason}</Badge> : null}
          </div>
          <p className="mt-1 text-base font-semibold text-[#18212f]">{line.originalText}</p>
          <p className="mt-1 text-sm text-[#42526b]">{line.koreanLyrics ?? "No Korean translation"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {line.recommendedVocabulary.map((word) => (
              <span className="rounded bg-[#eef2f6] px-2 py-1 text-xs text-[#18212f]" key={`${line.index}-${word.japanese}`}>
                {word.japanese} · {word.reading} · {word.korean}
              </span>
            ))}
          </div>
        </div>
      </div>
    </label>
  )
}

function formatMs(ms: number | null) {
  if (ms == null) return "no timing"
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
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
