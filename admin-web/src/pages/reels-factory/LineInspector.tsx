import * as React from "react"
import { AlertTriangle, Crosshair, LocateFixed } from "lucide-react"
import type { ReelsSongDetail } from "@/api/types"
import type { MvCrop, MvFrame } from "@reels/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  clampMvFrame,
  coverMvFrame,
  END_CARD_MS,
  FIT_WIDTH_MV_FRAME,
  formatMs,
  hasCrop,
  lineByIndex,
  MV_CROP_MAX,
  MV_OFFSET_X_MAX,
  MV_OFFSET_Y_MAX,
  MV_SCALE_MAX,
  MV_SCALE_MIN,
  NO_CROP,
  parseTimecode,
  tokenSelectable,
  type EditorState,
  type SongCredit,
} from "./reelEditor"

type Props = {
  detail: ReelsSongDetail
  editor: EditorState
  credit: SongCredit
  /** null 이면 캔버스를 꽉 채운다(cover). */
  mvFrame: MvFrame | null
  /** 올린 MV 의 가로/세로 비율. 메타데이터를 읽기 전엔 null. */
  mvAspect: number | null
  selectedIndex: number | null
  playheadMs: number
  errors: string[]
  onChangeCredit(credit: SongCredit): void
  onChangeMvFrame(frame: MvFrame | null): void
  onSetSourceStart(ms: number): void
  onSetEnd(ms: number): void
  onSetLineStart(index: number, ms: number): void
  onToggleLine(index: number): void
  onToggleToken(index: number, tokenIndex: number): void
  onSeekReel(ms: number): void
}

/** 오른쪽 패널. 위부터 곡 표기, MV 배치, 클립 시작·끝, 고른 줄의 타이밍과 단어. */
export function LineInspector({
  detail,
  editor,
  credit,
  mvFrame,
  mvAspect,
  selectedIndex,
  playheadMs,
  errors,
  onChangeCredit,
  onChangeMvFrame,
  onSetSourceStart,
  onSetEnd,
  onSetLineStart,
  onToggleLine,
  onToggleToken,
  onSeekReel,
}: Props) {
  const line = selectedIndex == null ? undefined : lineByIndex(detail, selectedIndex)
  const included = selectedIndex == null ? undefined : editor.lines.find((current) => current.index === selectedIndex)
  const hasClip = editor.lines.length > 0
  const spanMs = editor.endMs - editor.sourceStartMs
  // cover 상태에서 슬라이더를 움직이면 cover 와 같은 배치에서 출발한다. 비율을 모르면 그 값을 알 수 없어 막는다.
  const shownFrame = mvFrame ?? (mvAspect != null ? coverMvFrame(mvAspect) : null)
  const changeFrame = (patch: Partial<MvFrame>) => {
    if (shownFrame) onChangeMvFrame(clampMvFrame({ ...shownFrame, ...patch }))
  }
  const crop = shownFrame?.crop ?? NO_CROP
  // 꽉 채운 상태에서 자르면 잘라낸 영역으로 다시 꽉 채운다. 배치를 손본 뒤라면 배율·위치는 그대로 둔다.
  const changeCrop = (patch: Partial<MvCrop>) => {
    if (!shownFrame || mvAspect == null) return
    const next = { ...crop, ...patch }
    onChangeMvFrame(mvFrame == null ? coverMvFrame(mvAspect, next) : clampMvFrame({ ...shownFrame, crop: next }))
  }
  const fill = () => onChangeMvFrame(hasCrop(crop) && mvAspect != null ? coverMvFrame(mvAspect, crop) : null)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto rounded-lg border border-[#d9e1ea] bg-white text-sm">
      <section className="border-b border-[#e2e8f0] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#637083]">Song</span>
          <span className="truncate pl-2 text-xs text-[#637083]" title={`${detail.song.title} / ${detail.song.artist}`}>
            {detail.song.title} / {detail.song.artist}
          </span>
        </div>
        <div className="grid grid-cols-[48px_1fr] items-center gap-x-2 gap-y-1.5">
          <span className="font-mono text-xs text-[#637083]">TITLE</span>
          <TextInput ariaLabel="Song title" value={credit.title} onChange={(title) => onChangeCredit({ ...credit, title })} />
          <span className="font-mono text-xs text-[#637083]">ARTIST</span>
          <TextInput ariaLabel="Song artist" value={credit.artist} onChange={(artist) => onChangeCredit({ ...credit, artist })} />
        </div>
      </section>

      <section className="border-b border-[#e2e8f0] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#637083]">Frame</span>
          <div className="flex gap-1">
            <Button className="h-7 px-2 text-xs" onClick={() => onChangeMvFrame({ ...FIT_WIDTH_MV_FRAME, crop })} type="button" variant="ghost">
              가로 맞춤
            </Button>
            <Button
              className="h-7 px-2 text-xs"
              disabled={mvFrame == null}
              onClick={fill}
              type="button"
              variant="ghost"
            >
              꽉 채움
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-[48px_1fr_48px] items-center gap-x-2 gap-y-1.5">
          <FrameSlider
            disabled={shownFrame == null}
            format={(value) => `${Math.round(value * 100)}%`}
            label="SCALE"
            max={MV_SCALE_MAX}
            min={MV_SCALE_MIN}
            step={0.01}
            value={shownFrame?.scale ?? 1}
            onChange={(scale) => changeFrame({ scale })}
          />
          <FrameSlider
            disabled={shownFrame == null}
            label="X"
            max={MV_OFFSET_X_MAX}
            min={-MV_OFFSET_X_MAX}
            step={1}
            value={shownFrame?.x ?? 0}
            onChange={(x) => changeFrame({ x })}
          />
          <FrameSlider
            disabled={shownFrame == null}
            label="Y"
            max={MV_OFFSET_Y_MAX}
            min={-MV_OFFSET_Y_MAX}
            step={1}
            value={shownFrame?.y ?? 0}
            onChange={(y) => changeFrame({ y })}
          />
        </div>
        <div className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#637083]">Crop</div>
        <div className="grid grid-cols-[48px_1fr_48px] items-center gap-x-2 gap-y-1.5">
          {CROP_SIDES.map(([side, label]) => (
            <FrameSlider
              disabled={shownFrame == null}
              format={(value) => `${(value * 100).toFixed(1)}%`}
              key={side}
              label={label}
              max={MV_CROP_MAX}
              min={0}
              step={0.001}
              value={crop[side]}
              onChange={(value) => changeCrop({ [side]: value })}
            />
          ))}
        </div>
      </section>

      <section className="border-b border-[#e2e8f0] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#637083]">Clip</span>
          {hasClip ? (
            <span className="font-mono text-xs text-[#637083]">
              {formatMs(spanMs)} + {END_CARD_MS / 1000}s
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-[32px_1fr_auto] items-center gap-x-2 gap-y-1.5">
          <span className="font-mono text-xs text-[#637083]">IN</span>
          <TimecodeInput ariaLabel="Clip start" disabled={!hasClip} value={editor.sourceStartMs} onCommit={onSetSourceStart} />
          <PlayheadButton disabled={!hasClip} label="Set clip start at playhead" onClick={() => onSetSourceStart(playheadMs)} />
          <span className="font-mono text-xs text-[#637083]">OUT</span>
          <TimecodeInput ariaLabel="Clip end" disabled={!hasClip} value={editor.endMs} onCommit={onSetEnd} />
          <PlayheadButton disabled={!hasClip} label="Set clip end at playhead" onClick={() => onSetEnd(playheadMs)} />
        </div>
        {errors.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {errors.map((error) => (
              <li className="flex gap-1.5 text-xs text-[#b45309]" key={error}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {line ? (
        <section className="flex min-h-0 flex-1 flex-col p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#637083]">Line #{line.index + 1}</span>
            {line.startTimeMs != null ? (
              <span className="font-mono text-xs text-[#637083]">원본 {formatMs(line.startTimeMs)}</span>
            ) : (
              <span className="text-xs text-[#637083]">타임스탬프 없음</span>
            )}
          </div>

          {included ? (
            <div className="grid grid-cols-[32px_1fr_auto_auto] items-center gap-x-2">
              <span className="font-mono text-xs text-[#637083]">START</span>
              <TimecodeInput
                ariaLabel={`Line ${line.index} start`}
                value={included.startMs}
                onCommit={(ms) => onSetLineStart(line.index, ms)}
              />
              <PlayheadButton label="Set line start at playhead" onClick={() => onSetLineStart(line.index, playheadMs)} />
              <Button
                aria-label="Go to line start"
                onClick={() => onSeekReel(included.startMs)}
                size="icon"
                title="줄 시작으로 이동"
                type="button"
                variant="ghost"
              >
                <LocateFixed className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              disabled={!line.selectable}
              onClick={() => onToggleLine(line.index)}
              type="button"
              variant="secondary"
            >
              릴스에 넣기
            </Button>
          )}

          <p className="mt-3 text-base font-semibold leading-snug text-[#18212f]">{line.originalText}</p>
          <p className="mt-1 text-[#42526b]">{line.koreanLyrics ?? "번역 없음"}</p>

          <div className="mt-3 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#637083]">Words</span>
            <span className="font-mono text-xs text-[#637083]">
              {included?.tokenIndexes.length ?? 0}/{detail.maxVocabularyPerLine}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {line.tokens.map((token, tokenIndex) => {
              const selectable = tokenSelectable(token)
              const picked = included?.tokenIndexes.includes(tokenIndex) ?? false
              const full = (included?.tokenIndexes.length ?? 0) >= detail.maxVocabularyPerLine
              return (
                <button
                  aria-label={`Toggle word ${token.surface}`}
                  aria-pressed={picked}
                  className={cn(
                    "rounded-md border px-2 py-1 text-left leading-tight transition-colors disabled:cursor-not-allowed",
                    picked
                      ? "border-[#0f766e] bg-[#0f766e] text-white"
                      : selectable
                        ? "border-[#cbd5e1] bg-white text-[#18212f] hover:bg-[#eef2f6] disabled:opacity-50"
                        : "border-transparent bg-[#f1f5f9] text-[#94a3b8]",
                  )}
                  disabled={!included || !selectable || (!picked && full)}
                  key={tokenIndex}
                  onClick={() => onToggleToken(line.index, tokenIndex)}
                  type="button"
                >
                  <span className="block text-sm font-semibold">{token.surface}</span>
                  {selectable ? (
                    <span className={cn("block text-[10px]", picked ? "text-white/80" : "text-[#637083]")}>
                      {token.baseForm && token.baseForm !== token.surface ? `${token.baseForm} · ` : ""}
                      {token.koreanText}
                      {token.jlpt ? ` · ${token.jlpt}` : ""}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>
      ) : (
        <div className="p-3 text-xs text-[#637083]">왼쪽 목록에서 줄을 누르면 타이밍과 단어를 고칠 수 있습니다.</div>
      )}
    </div>
  )
}

function PlayheadButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick(): void }) {
  return (
    <Button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      size="icon"
      title="플레이헤드 위치로"
      type="button"
      variant="ghost"
    >
      <Crosshair className="h-4 w-4" />
    </Button>
  )
}

const CROP_SIDES: [keyof MvCrop, string][] = [
  ["top", "TOP"],
  ["bottom", "BOTTOM"],
  ["left", "LEFT"],
  ["right", "RIGHT"],
]

/** 슬라이더 한 줄. 라벨 · range · 값 순의 3칸을 부모 grid 에 그대로 깐다. */
function FrameSlider({
  label,
  min,
  max,
  step,
  value,
  disabled,
  format = (current) => String(current),
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  disabled?: boolean
  format?(value: number): string
  onChange(value: number): void
}) {
  return (
    <>
      <span className="font-mono text-xs text-[#637083]">{label}</span>
      <input
        aria-label={`MV ${label.toLowerCase()}`}
        className="h-2 w-full cursor-pointer accent-[#0f766e] disabled:cursor-not-allowed"
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <span className="text-right font-mono text-xs tabular-nums text-[#18212f]">{format(value)}</span>
    </>
  )
}

function TextInput({ ariaLabel, value, onChange }: { ariaLabel: string; value: string; onChange(value: string): void }) {
  return (
    <input
      aria-label={ariaLabel}
      className="focus-ring h-8 w-full rounded-md border border-[#cbd5e1] bg-white px-2 text-sm text-[#18212f]"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
      }}
      value={value}
    />
  )
}

/** `m:ss.t` 입력. Enter/blur 에 반영하고 못 읽는 값은 되돌린다. */
function TimecodeInput({
  ariaLabel,
  value,
  disabled,
  onCommit,
}: {
  ariaLabel: string
  value: number
  disabled?: boolean
  onCommit(ms: number): void
}) {
  const [text, setText] = React.useState(() => formatMs(value))
  const [editing, setEditing] = React.useState(false)
  React.useEffect(() => {
    if (!editing) setText(formatMs(value))
  }, [editing, value])
  const commit = () => {
    setEditing(false)
    const parsed = parseTimecode(text)
    if (parsed == null) {
      setText(formatMs(value))
      return
    }
    onCommit(parsed)
  }
  return (
    <input
      aria-label={ariaLabel}
      className="focus-ring h-8 w-full rounded-md border border-[#cbd5e1] bg-white px-2 font-mono text-sm text-[#18212f] disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"
      disabled={disabled}
      onBlur={commit}
      onChange={(event) => setText(event.target.value)}
      onFocus={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          setText(formatMs(value))
          event.currentTarget.blur()
        }
      }}
      value={text}
    />
  )
}
