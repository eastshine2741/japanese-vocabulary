import * as React from "react"
import type { ReelsLyricLine, ReelsSongDetail } from "@/api/types"
import { cn } from "@/lib/utils"
import { formatMs, type EditorLine, type EditorState } from "./reelEditor"

/** 곡의 모든 가사 줄. 체크하면 릴스에 들어가고, 줄을 누르면 인스펙터에 뜬다. */
export function LineBin({
  detail,
  editor,
  selectedIndex,
  onToggle,
  onSelect,
}: {
  detail: ReelsSongDetail
  editor: EditorState
  selectedIndex: number | null
  onToggle(index: number): void
  onSelect(index: number): void
}) {
  const byIndex = React.useMemo(() => new Map(editor.lines.map((line) => [line.index, line])), [editor.lines])
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-[#d9e1ea] bg-white">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#637083]">Lines</span>
        <span className="font-mono text-xs text-[#637083]">
          {editor.lines.length}/{detail.minLineCount}+
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {detail.lines.map((line) => (
          <LineRow
            included={byIndex.get(line.index)}
            key={line.index}
            line={line}
            selected={line.index === selectedIndex}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  )
}

const LineRow = React.memo(function LineRow({
  line,
  included,
  selected,
  onToggle,
  onSelect,
}: {
  line: ReelsLyricLine
  included: EditorLine | undefined
  selected: boolean
  onToggle(index: number): void
  onSelect(index: number): void
}) {
  const disabled = !line.selectable
  return (
    <div
      className={cn(
        "flex items-start gap-2 border-b border-[#f1f5f9] px-2 py-1.5 text-sm",
        selected ? "bg-[#e6fffb]" : "hover:bg-[#f8fafc]",
        disabled && "opacity-50",
      )}
    >
      <input
        aria-label={`Select lyric line ${line.index}`}
        checked={included != null}
        className="mt-1"
        disabled={disabled}
        onChange={() => onToggle(line.index)}
        type="checkbox"
      />
      <button
        className="min-w-0 flex-1 text-left"
        disabled={disabled}
        onClick={() => onSelect(line.index)}
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
