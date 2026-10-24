import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { LyricMvSyncDetail, LyricMvSyncLine } from "@/api/types"
import { DetailGrid, DetailItem } from "@/components/DetailGrid"
import { PageHeader } from "@/components/PageHeader"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { Badge } from "@/components/ui/badge"
import { Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"
import { cn, formatDateTime } from "@/lib/utils"
import { formatClock, formatDelta, lineAt } from "./lineAt"
import { syncStatusTone, verdictTone } from "./syncTones"
import { useYoutubePlayer } from "./youtubePlayer"

type Track = "synced" | "original"
// 줄을 누르면 조금 앞에서 틀어야 줄 첫 소리가 시각과 맞는지 들린다.
const PREROLLS_MS = [0, 500, 1000, 2000]

export function LyricMvSyncDetailPage() {
  const { token } = useAuth()
  const { syncId = "" } = useParams()
  const [sync, setSync] = React.useState<LyricMvSyncDetail | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .lyricMvSync(token!, syncId)
      .then((result) => {
        if (!alive) return
        setSync(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [syncId, token])

  if (state === "loading") return <LoadingState />
  if (state === "error" || !sync) return <ErrorState label="Could not load lyric MV sync." />
  return <SyncReview sync={sync} />
}

function SyncReview({ sync }: { sync: LyricMvSyncDetail }) {
  const { summary, lines } = sync
  const hasSynced = lines.some((line) => line.syncedStartTimeMs != null)
  const hasOriginal = lines.some((line) => line.originalStartTimeMs != null)
  const [track, setTrack] = React.useState<Track>(hasSynced ? "synced" : "original")
  const [prerollMs, setPrerollMs] = React.useState(1000)
  const { hostRef, ready, timeMs, seek, toggle } = useYoutubePlayer(summary.youtubeVideoId)

  const times = React.useMemo(
    () => lines.map((line) => (track === "synced" ? line.syncedStartTimeMs : line.originalStartTimeMs)),
    [lines, track],
  )
  const current = lineAt(times, timeMs)
  const rowRefs = React.useRef<(HTMLTableRowElement | null)[]>([])

  React.useEffect(() => {
    rowRefs.current[current]?.scrollIntoView?.({ block: "nearest" })
  }, [current])

  const playLine = React.useCallback(
    (index: number) => {
      const time = times[index]
      if (time != null) seek(time - prerollMs)
    },
    [times, seek, prerollMs],
  )

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.target as HTMLElement).closest("input, select, textarea")) return
      if (event.key === " ") {
        event.preventDefault()
        toggle()
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const step = event.key === "ArrowDown" ? 1 : -1
        let next = current + step
        while (next >= 0 && next < times.length && times[next] == null) next += step
        if (next >= 0 && next < times.length) playLine(next)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [current, times, toggle, playLine])

  return (
    <>
      <PageHeader
        title={summary.title ?? `Lyric ${summary.lyricId}`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span>{summary.artist}</span>
            <Badge tone={syncStatusTone(summary.status)}>{summary.status}</Badge>
            {summary.verdict ? <Badge tone={verdictTone(summary.verdict)}>{summary.verdict}</Badge> : null}
            {summary.method ? <Badge>{summary.method}</Badge> : null}
            {summary.inUse ? null : <Badge tone="warning">Not in use</Badge>}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,440px)_1fr]">
        <div className="min-w-0 lg:sticky lg:top-[76px] lg:self-start">
          <div ref={hostRef} className="aspect-video w-full overflow-hidden rounded-md bg-black [&>div]:h-full [&>div]:w-full [&_iframe]:h-full [&_iframe]:w-full" />
          <div className="mt-3 border-y border-[#d9e1ea] bg-white px-4 py-3">
            <div className="font-mono text-xs tabular-nums text-[#637083]">{ready ? formatClock(timeMs) : "Loading player"}</div>
            <div className="mt-1 min-h-14 text-lg font-semibold text-[#18212f]">{lines[current]?.text ?? ""}</div>
            <div className="min-h-5 text-sm text-[#637083]">{nextLine(lines, times, current)?.text ?? ""}</div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Segmented
              label="Times"
              options={[
                { value: "synced", label: "MV sync", disabled: !hasSynced },
                { value: "original", label: "Original", disabled: !hasOriginal },
              ]}
              value={track}
              onChange={(value) => setTrack(value as Track)}
            />
            <Segmented
              label="Lead-in"
              options={PREROLLS_MS.map((ms) => ({ value: String(ms), label: `${ms / 1000}s` }))}
              value={String(prerollMs)}
              onChange={(value) => setPrerollMs(Number(value))}
            />
          </div>
          <div className="mt-4">
            <SyncFacts sync={sync} />
          </div>
        </div>

        <Table className="min-w-0">
          <thead>
            <tr>
              <Th className="w-12">#</Th>
              <Th className="w-24">MV sync</Th>
              <Th className="w-24">Original</Th>
              <Th className="w-20">Shift</Th>
              <Th>Line</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <LineRow
                key={line.index}
                ref={(row) => {
                  rowRefs.current[index] = row
                }}
                line={line}
                index={index}
                active={index === current}
                track={track}
                onPlay={playLine}
              />
            ))}
          </tbody>
        </Table>
      </div>
    </>
  )
}

function nextLine(lines: LyricMvSyncLine[], times: (number | null)[], current: number) {
  for (let i = current + 1; i < lines.length; i++) if (times[i] != null) return lines[i]
  return null
}

const LineRow = React.memo(
  React.forwardRef<
    HTMLTableRowElement,
    { line: LyricMvSyncLine; index: number; active: boolean; track: Track; onPlay: (index: number) => void }
  >(function LineRow({ line, index, active, track, onPlay }, ref) {
    return (
      <tr
        ref={ref}
        onClick={() => onPlay(index)}
        className={cn("cursor-pointer hover:bg-[#f9fbfc]", active && "bg-[#e6fffb] hover:bg-[#e6fffb]")}
      >
        <Td className="h-10 font-mono text-xs text-[#637083]">{line.index}</Td>
        <Td className={cn("h-10 font-mono text-xs tabular-nums", track === "synced" ? "text-[#18212f]" : "text-[#94a3b8]")}>
          {formatClock(line.syncedStartTimeMs)}
        </Td>
        <Td className={cn("h-10 font-mono text-xs tabular-nums", track === "original" ? "text-[#18212f]" : "text-[#94a3b8]")}>
          {formatClock(line.originalStartTimeMs)}
        </Td>
        <Td className="h-10 font-mono text-xs tabular-nums text-[#637083]">
          {formatDelta(line.syncedStartTimeMs, line.originalStartTimeMs)}
        </Td>
        <Td className={cn("h-10", active && "font-semibold")}>{line.text}</Td>
      </tr>
    )
  }),
)

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string; disabled?: boolean }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase text-[#637083]">{label}</span>
      <div className="inline-flex overflow-hidden rounded-md border border-[#cbd5e1] bg-white" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-ring h-8 border-l border-[#cbd5e1] px-3 text-xs font-medium first:border-l-0 disabled:text-[#cbd5e1]",
              option.value === value ? "bg-[#0f766e] text-white" : "text-[#42526b] hover:bg-[#eef2f6]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SyncFacts({ sync }: { sync: LyricMvSyncDetail }) {
  const { summary, confidence } = sync
  const within = confidence?.within500ms
  const segments = Array.isArray(confidence?.segments)
    ? (confidence.segments as { fromLrcSec: number; offsetSec: number }[])
    : []
  return (
    <DetailGrid>
      <DetailItem
        label="Lines found"
        value={summary.lineCount != null ? `${summary.anchoredCount ?? 0} / ${summary.lineCount}` : "-"}
      />
      <DetailItem label="Re-listened / snapped" value={confidence ? `${confidence.filled ?? 0} / ${confidence.snapped ?? 0}` : "-"} />
      <DetailItem label="Within 0.5s" value={typeof within === "number" ? `${Math.round(within * 100)}%` : "-"} />
      <DetailItem
        label="MV offset"
        value={
          segments.length > 0
            ? segments.map((segment) => (
                <div key={segment.fromLrcSec} className="font-mono text-xs tabular-nums">
                  from {segment.fromLrcSec.toFixed(2)}s: {segment.offsetSec >= 0 ? "+" : ""}
                  {segment.offsetSec.toFixed(2)}s
                </div>
              ))
            : "-"
        }
      />
      <DetailItem
        label="Song"
        value={summary.songId ? <Link className="text-[#0f766e] hover:underline" to={`/songs/${summary.songId}`}>{summary.songId}</Link> : "-"}
      />
      <DetailItem
        label="Lyric"
        value={
          <Link className="text-[#0f766e] hover:underline" to={`/lyrics/${summary.lyricId}`}>
            {summary.lyricId} {summary.lyricType ? `(${summary.lyricType})` : ""}
          </Link>
        }
      />
      <DetailItem
        label="MV"
        value={
          <a className="font-mono text-xs text-[#0f766e] hover:underline" href={`https://www.youtube.com/watch?v=${summary.youtubeVideoId}`} rel="noreferrer" target="_blank">
            {summary.youtubeVideoId}
          </a>
        }
      />
      <DetailItem label="Completed" value={`${formatDateTime(summary.completedAt)} (attempt ${summary.attempt})`} />
      {summary.errorMessage ? <DetailItem label="Error" value={summary.errorMessage} /> : null}
    </DetailGrid>
  )
}
