import * as React from "react"
import type { ReelsSongDetail } from "@/api/types"
import { cn } from "@/lib/utils"
import { END_CARD_MS, formatMs, lineByIndex, type EditorState } from "./reelEditor"

type Props = {
  detail: ReelsSongDetail
  editor: EditorState
  /** MV 전체 길이. 메타데이터를 읽기 전엔 곡 길이로 대신한다. */
  mvDurationMs: number
  playheadMs: number
  selectedIndex: number | null
  onSeekSource(ms: number): void
  onSeekReel(ms: number): void
  /** 클립 전체를 옮겨 시작이 이 시각이 되게 한다. */
  onMoveClip(sourceStartMs: number): void
  onSetSourceStart(ms: number): void
  onSetEnd(ms: number): void
  onSetLineStart(index: number, ms: number): void
  onSelectLine(index: number): void
}

/**
 * 위 줄은 MV 전체 오버뷰(클립 구간을 끌어 옮김), 아래 줄은 클립 구간을 펼친 상세 타임라인(줄 시작을 끌어 옮김).
 * 오버뷰를 누르면 Source 모니터가, 상세를 누르면 Reel 모니터가 그 시각으로 간다.
 */
export function ReelTimeline({
  detail,
  editor,
  mvDurationMs,
  playheadMs,
  selectedIndex,
  onSeekSource,
  onSeekReel,
  onMoveClip,
  onSetSourceStart,
  onSetEnd,
  onSetLineStart,
  onSelectLine,
}: Props) {
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-[#d9e1ea] bg-white p-3">
      <Overview
        editor={editor}
        mvDurationMs={mvDurationMs}
        playheadMs={playheadMs}
        onSeek={onSeekSource}
        onMoveClip={onMoveClip}
        onSetSourceStart={onSetSourceStart}
        onSetEnd={onSetEnd}
      />
      <Detail
        detail={detail}
        editor={editor}
        playheadMs={playheadMs}
        selectedIndex={selectedIndex}
        onSeek={onSeekReel}
        onSetEnd={onSetEnd}
        onSetLineStart={onSetLineStart}
        onSelectLine={onSelectLine}
      />
    </div>
  )
}

// ─── 오버뷰 ────────────────────────────────────────────────────────────────────

function Overview({
  editor,
  mvDurationMs,
  playheadMs,
  onSeek,
  onMoveClip,
  onSetSourceStart,
  onSetEnd,
}: {
  editor: EditorState
  mvDurationMs: number
  playheadMs: number
  onSeek(ms: number): void
  onMoveClip(sourceStartMs: number): void
  onSetSourceStart(ms: number): void
  onSetEnd(ms: number): void
}) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const total = Math.max(mvDurationMs, editor.endMs + END_CARD_MS, 1000)
  const msPerPx = () => total / Math.max(1, trackRef.current?.clientWidth ?? 1)
  const msAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return clamp(((clientX - rect.left) / rect.width) * total, 0, total)
  }
  const hasClip = editor.lines.length > 0
  const left = pct(editor.sourceStartMs, total)
  const width = pct(editor.endMs - editor.sourceStartMs, total)

  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[#637083]">MV</span>
      <div
        aria-label="MV overview"
        className="relative h-7 flex-1 cursor-pointer rounded bg-[#e2e8f0]"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          onSeek(msAt(event.clientX))
          startDrag(event, { onMove: (_delta, clientX) => onSeek(msAt(clientX)) })
        }}
        ref={trackRef}
        role="presentation"
      >
        {hasClip ? (
          <div
            aria-label="Clip range"
            className="absolute inset-y-0 cursor-grab rounded bg-[#0f766e]/25 ring-1 ring-[#0f766e] active:cursor-grabbing"
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.stopPropagation()
              const scale = msPerPx()
              const originMs = editor.sourceStartMs
              startDrag(event, {
                onMove: (deltaPx) => onMoveClip(originMs + deltaPx * scale),
                onEnd: (moved) => {
                  if (!moved) onSeek(msAt(event.clientX))
                },
              })
            }}
            style={{ left: `${left}%`, width: `${Math.max(width, 0.4)}%` }}
          >
            <Handle
              ariaLabel="Clip start handle"
              side="left"
              onDrag={(clientX) => onSetSourceStart(msAt(clientX))}
            />
            <Handle ariaLabel="Clip end handle" side="right" onDrag={(clientX) => onSetEnd(msAt(clientX))} />
          </div>
        ) : null}
        {editor.lines.map((line) => (
          <div
            className="pointer-events-none absolute top-1 bottom-1 w-px bg-[#0f766e]"
            key={line.index}
            style={{ left: `${pct(line.startMs, total)}%` }}
          />
        ))}
        <Playhead percent={pct(playheadMs, total)} />
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-xs text-[#637083]">{formatMs(total)}</span>
    </div>
  )
}

// ─── 상세 타임라인 ───────────────────────────────────────────────────────────────

function Detail({
  detail,
  editor,
  playheadMs,
  selectedIndex,
  onSeek,
  onSetEnd,
  onSetLineStart,
  onSelectLine,
}: {
  detail: ReelsSongDetail
  editor: EditorState
  playheadMs: number
  selectedIndex: number | null
  onSeek(ms: number): void
  onSetEnd(ms: number): void
  onSetLineStart(index: number, ms: number): void
  onSelectLine(index: number): void
}) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const windowStart = editor.sourceStartMs
  const windowLength = Math.max(editor.endMs + END_CARD_MS - windowStart, 1000)
  const msPerPx = () => windowLength / Math.max(1, trackRef.current?.clientWidth ?? 1)
  const msAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return windowStart
    return windowStart + clamp(((clientX - rect.left) / rect.width) * windowLength, 0, windowLength)
  }
  const at = (ms: number) => pct(ms - windowStart, windowLength)
  const ticks = React.useMemo(() => buildTicks(windowStart, windowLength), [windowStart, windowLength])

  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-3">
      <span className="w-14 shrink-0 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#637083]">Reel</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative h-4 select-none text-[10px] text-[#7b8798]">
          {ticks.map((tick) => (
            <span className="absolute -translate-x-1/2 font-mono" key={tick} style={{ left: `${at(tick)}%` }}>
              {formatMs(tick)}
            </span>
          ))}
        </div>
        <div
          aria-label="Reel timeline"
          className="relative min-h-[72px] flex-1 cursor-pointer rounded bg-[#f1f5f9]"
          onPointerDown={(event) => {
            if (event.button !== 0) return
            onSeek(msAt(event.clientX))
            startDrag(event, { onMove: (_delta, clientX) => onSeek(msAt(clientX)) })
          }}
          ref={trackRef}
          role="presentation"
        >
          {ticks.map((tick) => (
            <div className="pointer-events-none absolute inset-y-0 w-px bg-[#e2e8f0]" key={tick} style={{ left: `${at(tick)}%` }} />
          ))}
          {editor.lines.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-[#94a3b8]">
              왼쪽 목록에서 가사 줄을 고르면 여기 놓입니다
            </div>
          ) : null}
          {editor.lines.map((line, position) => {
            const nextStart = editor.lines[position + 1]?.startMs ?? editor.endMs
            const source = lineByIndex(detail, line.index)
            const selected = line.index === selectedIndex
            return (
              <div
                aria-label={`Line ${line.index} block`}
                className={cn(
                  "absolute top-2 bottom-2 cursor-grab overflow-hidden rounded border-l-4 pl-1.5 pr-1 text-left text-xs active:cursor-grabbing",
                  selected
                    ? "border-[#0f766e] bg-[#0f766e] text-white"
                    : "border-[#0f766e] bg-[#ccfbf1] text-[#134e4a] hover:bg-[#99f6e4]",
                )}
                key={line.index}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  event.stopPropagation()
                  const scale = msPerPx()
                  const startMs = line.startMs
                  startDrag(event, {
                    onMove: (deltaPx) => onSetLineStart(line.index, startMs + deltaPx * scale),
                    onEnd: (moved) => {
                      onSelectLine(line.index)
                      if (!moved) onSeek(line.startMs)
                    },
                  })
                }}
                style={{ left: `${at(line.startMs)}%`, width: `${Math.max(pct(nextStart - line.startMs, windowLength), 0.3)}%` }}
              >
                <div className="truncate pt-1 font-mono text-[10px] opacity-80">
                  #{line.index + 1} · {formatMs(line.startMs)}
                </div>
                <div className="truncate font-semibold">{source?.originalText}</div>
                <div className="truncate text-[10px] opacity-80">
                  {line.tokenIndexes
                    .map((tokenIndex) => source?.tokens[tokenIndex])
                    .filter(Boolean)
                    .map((token) => token!.baseForm || token!.surface)
                    .join(" · ")}
                </div>
              </div>
            )
          })}
          {editor.lines.length > 0 ? (
            <>
              <div
                className="pointer-events-none absolute top-2 bottom-2 rounded bg-[#cbd5e1] text-center text-[10px] leading-[68px] text-[#475569]"
                style={{ left: `${at(editor.endMs)}%`, width: `${pct(END_CARD_MS, windowLength)}%` }}
              >
                엔드카드
              </div>
              <div
                aria-label="Lyrics end"
                className="absolute inset-y-0 z-10 w-2 -translate-x-1/2 cursor-ew-resize"
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  event.stopPropagation()
                  startDrag(event, { onMove: (_delta, clientX) => onSetEnd(msAt(clientX)) })
                }}
                style={{ left: `${at(editor.endMs)}%` }}
              >
                <div className="mx-auto h-full w-0.5 bg-[#475569]" />
              </div>
            </>
          ) : null}
          <Playhead percent={at(playheadMs)} />
        </div>
      </div>
    </div>
  )
}

// ─── 조각 ──────────────────────────────────────────────────────────────────────

function Handle({
  ariaLabel,
  side,
  onDrag,
}: {
  ariaLabel: string
  side: "left" | "right"
  onDrag(clientX: number): void
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "absolute inset-y-0 z-10 w-2.5 cursor-ew-resize bg-[#0f766e]",
        side === "left" ? "left-0 rounded-l" : "right-0 rounded-r",
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        startDrag(event, { onMove: (_delta, clientX) => onDrag(clientX) })
      }}
      role="presentation"
    />
  )
}

function Playhead({ percent }: { percent: number }) {
  if (percent < 0 || percent > 100) return null
  return (
    <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-[#dc2626]" style={{ left: `${percent}%` }}>
      <div className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#dc2626]" />
    </div>
  )
}

/**
 * 포인터 드래그. 창 단위 리스너라 트랙 밖으로 나가도 계속 잡힌다.
 * 3px 이내 움직임은 클릭으로 본다(onEnd 의 moved=false).
 */
function startDrag(
  event: React.PointerEvent,
  handlers: { onMove?(deltaPx: number, clientX: number): void; onEnd?(moved: boolean): void },
) {
  const originX = event.clientX
  let moved = false
  const onMove = (move: PointerEvent) => {
    const delta = move.clientX - originX
    if (Math.abs(delta) > 3) moved = true
    if (moved) handlers.onMove?.(delta, move.clientX)
  }
  const onUp = () => {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onUp)
    handlers.onEnd?.(moved)
  }
  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onUp)
}

/** 창 폭에 맞춰 1·2·5·10초 눈금. 눈금은 12개 안팎이다. */
function buildTicks(startMs: number, lengthMs: number): number[] {
  const step = [1000, 2000, 5000, 10000, 20000, 30000].find((candidate) => lengthMs / candidate <= 12) ?? 60000
  const first = Math.ceil(startMs / step) * step
  const ticks: number[] = []
  for (let tick = first; tick <= startMs + lengthMs; tick += step) ticks.push(tick)
  return ticks
}

const pct = (ms: number, total: number) => (total <= 0 ? 0 : (ms / total) * 100)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
