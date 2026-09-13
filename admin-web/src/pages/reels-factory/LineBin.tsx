import * as React from "react"
import { Check, X } from "lucide-react"
import type { ReelsLyricLine, ReelsSongDetail } from "@/api/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatMs, type EditorLine, type EditorState } from "./reelEditor"

/**
 * 곡의 모든 가사 줄. 릴스에 넣을 줄을 여기서 고른다.
 * - 왼쪽 체크를 누르면 그 줄만 넣거나 뺀다.
 * - 아무 데서나 눌러 위아래로 끌면 처음 누른 줄부터 지나간 줄까지 한 번에 넣거나 뺀다(처음 줄이 안 들어가 있었으면 넣기, 들어가 있었으면 빼기).
 * - 본문을 누르면 인스펙터에 뜨고, Shift+클릭이면 마지막으로 누른 줄부터 범위로 넣는다.
 */
export function LineBin({
  detail,
  editor,
  selectedIndex,
  onSetIncluded,
  onClear,
  onSelect,
}: {
  detail: ReelsSongDetail
  editor: EditorState
  selectedIndex: number | null
  onSetIncluded(indexes: number[], included: boolean): void
  onClear(): void
  onSelect(index: number): void
}) {
  const byIndex = React.useMemo(() => new Map(editor.lines.map((line) => [line.index, line])), [editor.lines])
  const positionOf = React.useMemo(() => new Map(detail.lines.map((line, position) => [line.index, position])), [detail.lines])
  const listRef = React.useRef<HTMLDivElement>(null)
  const [drag, setDrag] = React.useState<Drag | null>(null)
  const dragRef = React.useRef<Drag | null>(null)
  /** 끌기로 넣고 나서 같은 줄에 떨어지는 click 이 한 번 더 토글하지 않게 막는다. */
  const suppressClick = React.useRef(false)
  /** Shift+클릭 범위의 시작. 마지막으로 누른 줄이다. */
  const lastAnchor = React.useRef<number | null>(null)
  const pointerY = React.useRef(0)

  const rangeBetween = React.useCallback(
    (a: number, b: number) => {
      const from = positionOf.get(a)
      const to = positionOf.get(b)
      if (from == null || to == null) return [a]
      return detail.lines.slice(Math.min(from, to), Math.max(from, to) + 1).map((line) => line.index)
    },
    [detail.lines, positionOf],
  )

  const updateDrag = React.useCallback((next: Drag | null) => {
    dragRef.current = next
    setDrag(next)
  }, [])

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || event.shiftKey) return
      const index = lineIndexAt(event.target)
      if (index == null) return
      pointerY.current = event.clientY
      updateDrag({ anchor: index, current: index, mode: byIndex.has(index) ? "remove" : "add", moved: false })
    },
    [byIndex, updateDrag],
  )

  const handlePointerOver = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = dragRef.current
      if (!current) return
      const index = lineIndexAt(event.target)
      if (index == null || index === current.current) return
      updateDrag({ ...current, current: index, moved: true })
    },
    [updateDrag],
  )

  // 끌기는 목록 밖에서 놓아도 끝나야 하니 window 에서 듣는다. 가장자리에 머물면 목록을 밀어 준다.
  React.useEffect(() => {
    if (!drag) return
    const finish = () => {
      const current = dragRef.current
      updateDrag(null)
      if (!current) return
      if (current.moved) {
        // click 은 pointerup 직후 같은 태스크에서 온다. 다른 줄에 놓으면 버튼이 아닌 공통 조상에 오니 여기서 풀어 준다.
        suppressClick.current = true
        window.setTimeout(() => {
          suppressClick.current = false
        }, 0)
        onSetIncluded(rangeBetween(current.anchor, current.current), current.mode === "add")
        onSelect(current.current)
        lastAnchor.current = current.current
      }
    }
    const onMove = (event: PointerEvent) => {
      pointerY.current = event.clientY
    }
    let frame = 0
    const autoScroll = () => {
      const list = listRef.current
      const current = dragRef.current
      if (list && current) {
        const rect = list.getBoundingClientRect()
        const y = pointerY.current
        const delta = y < rect.top + EDGE_PX ? -(rect.top + EDGE_PX - y) : y > rect.bottom - EDGE_PX ? y - (rect.bottom - EDGE_PX) : 0
        if (delta !== 0) {
          list.scrollTop += Math.sign(delta) * Math.min(Math.abs(delta), EDGE_PX) * 0.5
          const clampedY = Math.min(Math.max(y, rect.top + 1), rect.bottom - 1)
          const index = typeof document.elementFromPoint === "function" ? lineIndexAt(document.elementFromPoint(rect.left + rect.width / 2, clampedY)) : null
          if (index != null && index !== current.current) updateDrag({ ...current, current: index, moved: true })
        }
      }
      frame = window.requestAnimationFrame(autoScroll)
    }
    frame = window.requestAnimationFrame(autoScroll)
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", finish)
    window.addEventListener("pointermove", onMove)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", finish)
      window.removeEventListener("pointermove", onMove)
    }
  }, [drag, onSelect, onSetIncluded, rangeBetween, updateDrag])

  const handleToggle = React.useCallback(
    (index: number) => {
      if (suppressClick.current) return
      onSetIncluded([index], !byIndex.has(index))
      onSelect(index)
      lastAnchor.current = index
    },
    [byIndex, onSetIncluded, onSelect],
  )

  const handleOpen = React.useCallback(
    (index: number, shiftKey: boolean) => {
      if (suppressClick.current) return
      if (shiftKey && lastAnchor.current != null) {
        onSetIncluded(rangeBetween(lastAnchor.current, index), !byIndex.has(index))
      }
      onSelect(index)
      lastAnchor.current = index
    },
    [byIndex, onSetIncluded, onSelect, rangeBetween],
  )

  const pendingRange = React.useMemo(() => {
    if (!drag || !drag.moved) return null
    return new Set(rangeBetween(drag.anchor, drag.current))
  }, [drag, rangeBetween])

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-[#d9e1ea] bg-white">
      <div className="flex h-9 items-center justify-between border-b border-[#e2e8f0] pr-1 pl-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#637083]">Lines</span>
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-[#637083]">
            {editor.lines.length}/{detail.minLineCount}+
          </span>
          {editor.lines.length > 0 ? (
            <Button aria-label="Clear selected lines" className="h-6 w-6" onClick={onClear} size="icon" title="전부 빼기" type="button" variant="ghost">
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      <div
        className={cn("min-h-0 flex-1 touch-none overflow-auto select-none", drag && "cursor-row-resize")}
        onPointerDown={handlePointerDown}
        onPointerOver={handlePointerOver}
        ref={listRef}
      >
        {detail.lines.map((line) => (
          <LineRow
            included={byIndex.get(line.index)}
            key={line.index}
            line={line}
            pending={pendingRange?.has(line.index) ? drag?.mode === "add" : undefined}
            selected={line.index === selectedIndex}
            onOpen={handleOpen}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </div>
  )
}

type Drag = {
  anchor: number
  current: number
  mode: "add" | "remove"
  /** 다른 줄까지 끌었는지. 안 끌었으면 그냥 클릭이라 click 핸들러에 맡긴다. */
  moved: boolean
}

/** 이 안쪽에서 끌고 있으면 목록이 스크롤된다. */
const EDGE_PX = 28

function lineIndexAt(target: EventTarget | Element | null): number | null {
  if (!(target instanceof Element)) return null
  const row = target.closest<HTMLElement>("[data-line-index]")
  if (!row || row.dataset.lineIndex == null) return null
  return Number(row.dataset.lineIndex)
}

const LineRow = React.memo(function LineRow({
  line,
  included,
  selected,
  pending,
  onToggle,
  onOpen,
}: {
  line: ReelsLyricLine
  included: EditorLine | undefined
  selected: boolean
  /** 끌기 범위에 들어 있으면 놓았을 때 될 상태, 아니면 undefined. */
  pending: boolean | undefined
  onToggle(index: number): void
  onOpen(index: number, shiftKey: boolean): void
}) {
  const disabled = !line.selectable
  const shown = disabled ? false : (pending ?? included != null)
  return (
    <div
      className={cn(
        "flex items-stretch border-b border-[#f1f5f9] border-l-[3px] text-sm",
        shown ? "border-l-[#0f766e] bg-[#f0fdfa]" : "border-l-transparent",
        selected && "bg-[#ccfbf1]",
        !shown && !selected && "hover:bg-[#f8fafc]",
        pending != null && "ring-1 ring-inset ring-[#0f766e]/40",
        disabled && "opacity-50",
      )}
      data-line-index={line.index}
    >
      <button
        aria-label={`Select lyric line ${line.index}`}
        aria-pressed={included != null}
        className="flex w-8 shrink-0 cursor-pointer items-start justify-center pt-2 disabled:cursor-not-allowed"
        disabled={disabled}
        onClick={() => onToggle(line.index)}
        type="button"
      >
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border",
            shown ? "border-[#0f766e] bg-[#0f766e] text-white" : "border-[#cbd5e1] bg-white",
          )}
        >
          {shown ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
        </span>
      </button>
      <button
        className="min-w-0 flex-1 cursor-pointer py-1.5 pr-2 text-left disabled:cursor-not-allowed"
        disabled={disabled}
        onClick={(event) => onOpen(line.index, event.shiftKey)}
        type="button"
      >
        <div className="flex items-center gap-2 font-mono text-[10px] text-[#637083]">
          <span>#{line.index + 1}</span>
          <span>{included ? formatMs(included.startMs) : line.startTimeMs != null ? formatMs(line.startTimeMs) : "—"}</span>
          {included && line.startTimeMs != null && Math.abs(included.startMs - line.startTimeMs) >= 100 ? (
            <span className="text-[#b45309]">원본 {formatMs(line.startTimeMs)}</span>
          ) : null}
          {disabled ? <span className="text-[#b45309]">{line.ineligibleReason}</span> : null}
        </div>
        <div className="truncate text-[#18212f]">{line.originalText}</div>
      </button>
    </div>
  )
})
