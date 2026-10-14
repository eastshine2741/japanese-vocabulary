import * as React from "react"
import { AlertTriangle, Crosshair, LocateFixed, Plus, RotateCcw, X } from "lucide-react"
import type { ReelsSongDetail } from "@/api/types"
import type { MvCrop, MvFrame } from "@reels/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  activeMvKeyframe,
  addMvKeyframe,
  clampHeadlineFontSize,
  clampHeadlineOffsetY,
  clampLyricOffsetY,
  clampLyricScale,
  clampMvFrame,
  coverMvFrame,
  DEFAULT_HEADLINE_FONT_SIZE,
  DEFAULT_LYRIC_SCALE,
  END_CARD_MS,
  FIT_WIDTH_MV_FRAME,
  formatMs,
  hasCrop,
  HEADLINE_FONT_SIZE_MAX,
  HEADLINE_FONT_SIZE_MIN,
  HEADLINE_OFFSET_Y_MAX,
  HEADLINE_OFFSET_Y_MIN,
  lineByIndex,
  LYRIC_OFFSET_Y_MAX,
  LYRIC_OFFSET_Y_MIN,
  LYRIC_SCALE_MAX,
  LYRIC_SCALE_MIN,
  MV_CROP_MAX,
  MV_OFFSET_X_MAX,
  MV_OFFSET_Y_MAX,
  MV_SCALE_MAX,
  MV_SCALE_MIN,
  mvFrameAt,
  NO_CROP,
  parseTimecode,
  removeMvKeyframe,
  setMvFrameAt,
  tokenMeaning,
  tokenSelectable,
  tokenTakesMeaning,
  type EditorState,
  type MvTrack,
  type ReelCaption,
} from "./reelEditor"

type Props = {
  detail: ReelsSongDetail
  editor: EditorState
  caption: ReelCaption
  /** 인스펙터는 플레이헤드에 적용 중인 배치(처음 배치 또는 키프레임)를 고친다. */
  mvTrack: MvTrack
  /** 올린 MV 의 가로/세로 비율. 메타데이터를 읽기 전엔 null. */
  mvAspect: number | null
  /** 상단 헤드라인 글자 크기(px). 릴스 전체에 고정이다. */
  headlineFontSize: number
  /** 계정명·헤드라인 세로 이동(px, + 가 아래). */
  headlineOffsetY: number
  /** 가사 원문 글자 배율. 릴스 전체에 고정이다. */
  lyricScale: number
  /** 가사 블록 세로 이동(px, + 가 아래). 릴스 전체에 고정이다. */
  lyricOffsetY: number
  selectedIndex: number | null
  playheadMs: number
  errors: string[]
  onChangeCaption(caption: ReelCaption): void
  onChangeMvTrack(track: MvTrack): void
  onSetKeyframeTime(index: number, ms: number): void
  onChangeHeadlineFontSize(size: number): void
  onChangeHeadlineOffsetY(offset: number): void
  onChangeLyricScale(scale: number): void
  onChangeLyricOffsetY(offset: number): void
  onSetSourceStart(ms: number): void
  onSetEnd(ms: number): void
  onSetLineStart(index: number, ms: number): void
  onToggleLine(index: number): void
  onToggleToken(index: number, tokenIndex: number): void
  /** `meaning` 이 null 이면 분석 결과의 뜻으로 되돌린다. */
  onSetTokenMeaning(index: number, tokenIndex: number, meaning: string | null): void
  onSeekReel(ms: number): void
}

/** 오른쪽 패널. 위부터 곡 표기·헤드라인, MV 배치, 가사 크기·위치, 클립 시작·끝, 고른 줄의 타이밍·단어·뜻. */
export function LineInspector({
  detail,
  editor,
  caption,
  mvTrack,
  mvAspect,
  headlineFontSize,
  headlineOffsetY,
  lyricScale,
  lyricOffsetY,
  selectedIndex,
  playheadMs,
  errors,
  onChangeCaption,
  onChangeMvTrack,
  onSetKeyframeTime,
  onChangeHeadlineFontSize,
  onChangeHeadlineOffsetY,
  onChangeLyricScale,
  onChangeLyricOffsetY,
  onSetSourceStart,
  onSetEnd,
  onSetLineStart,
  onToggleLine,
  onToggleToken,
  onSetTokenMeaning,
  onSeekReel,
}: Props) {
  const line = selectedIndex == null ? undefined : lineByIndex(detail, selectedIndex)
  const included = selectedIndex == null ? undefined : editor.lines.find((current) => current.index === selectedIndex)
  const hasClip = editor.lines.length > 0
  const spanMs = editor.endMs - editor.sourceStartMs
  const activeKeyframe = activeMvKeyframe(mvTrack, playheadMs)
  const mvFrame = mvFrameAt(mvTrack, playheadMs)
  const onChangeMvFrame = (frame: MvFrame | null) => onChangeMvTrack(setMvFrameAt(mvTrack, playheadMs, frame))
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
  const coverScale = mvAspect != null ? coverMvFrame(mvAspect, crop).scale : 1

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
          <TextInput ariaLabel="Song title" value={caption.title} onChange={(title) => onChangeCaption({ ...caption, title })} />
          <span className="font-mono text-xs text-[#637083]">ARTIST</span>
          <TextInput ariaLabel="Song artist" value={caption.artist} onChange={(artist) => onChangeCaption({ ...caption, artist })} />
          <span className="mt-1 self-start font-mono text-xs text-[#637083]">HEAD</span>
          <HeadlineInput value={caption.headline} onChange={(headline) => onChangeCaption({ ...caption, headline })} />
        </div>
        <div className={cn("mt-1.5", SLIDER_GRID)}>
          <FrameSlider
            ariaLabel="Headline size"
            defaultValue={DEFAULT_HEADLINE_FONT_SIZE}
            label="SIZE"
            suffix="px"
            max={HEADLINE_FONT_SIZE_MAX}
            min={HEADLINE_FONT_SIZE_MIN}
            step={1}
            value={headlineFontSize}
            onChange={(size) => onChangeHeadlineFontSize(clampHeadlineFontSize(size))}
          />
          <FrameSlider
            ariaLabel="Headline y"
            defaultValue={0}
            label="Y"
            suffix="px"
            max={HEADLINE_OFFSET_Y_MAX}
            min={HEADLINE_OFFSET_Y_MIN}
            step={1}
            value={headlineOffsetY}
            onChange={(offset) => onChangeHeadlineOffsetY(clampHeadlineOffsetY(offset))}
          />
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
        <KeyframeList
          active={activeKeyframe}
          clipStartMs={editor.sourceStartMs}
          track={mvTrack}
          onAdd={() => onChangeMvTrack(addMvKeyframe(mvTrack, playheadMs))}
          onRemove={(index) => onChangeMvTrack(removeMvKeyframe(mvTrack, index))}
          onSetTime={onSetKeyframeTime}
          onSeek={onSeekReel}
        />
        <div className={SLIDER_GRID}>
          <FrameSlider
            defaultValue={coverScale}
            disabled={shownFrame == null}
            factor={100}
            label="SCALE"
            suffix="%"
            max={MV_SCALE_MAX}
            min={MV_SCALE_MIN}
            step={0.01}
            value={shownFrame?.scale ?? 1}
            onChange={(scale) => changeFrame({ scale })}
          />
          <FrameSlider
            defaultValue={0}
            disabled={shownFrame == null}
            label="X"
            max={MV_OFFSET_X_MAX}
            min={-MV_OFFSET_X_MAX}
            step={1}
            value={shownFrame?.x ?? 0}
            onChange={(x) => changeFrame({ x })}
          />
          <FrameSlider
            defaultValue={0}
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
        <div className={SLIDER_GRID}>
          {CROP_SIDES.map(([side, label]) => (
            <FrameSlider
              defaultValue={0}
              disabled={shownFrame == null}
              digits={1}
              factor={100}
              key={side}
              label={label}
              max={MV_CROP_MAX}
              suffix="%"
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
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#637083]">Lyric</span>
          <Button
            className="h-7 px-2 text-xs"
            disabled={lyricScale === DEFAULT_LYRIC_SCALE && lyricOffsetY === 0}
            onClick={() => {
              onChangeLyricScale(DEFAULT_LYRIC_SCALE)
              onChangeLyricOffsetY(0)
            }}
            type="button"
            variant="ghost"
          >
            기본값
          </Button>
        </div>
        <div className={SLIDER_GRID}>
          <FrameSlider
            ariaLabel="Lyric size"
            defaultValue={DEFAULT_LYRIC_SCALE}
            factor={100}
            label="SIZE"
            max={LYRIC_SCALE_MAX}
            min={LYRIC_SCALE_MIN}
            step={0.01}
            suffix="%"
            value={lyricScale}
            onChange={(scale) => onChangeLyricScale(clampLyricScale(scale))}
          />
          <FrameSlider
            ariaLabel="Lyric y"
            defaultValue={0}
            label="Y"
            max={LYRIC_OFFSET_Y_MAX}
            min={LYRIC_OFFSET_Y_MIN}
            step={1}
            suffix="px"
            value={lyricOffsetY}
            onChange={(offset) => onChangeLyricOffsetY(clampLyricOffsetY(offset))}
          />
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
              {included?.tokenIndexes.length ?? 0}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {line.tokens.map((token, tokenIndex) => {
              const meaning = tokenMeaning(token, included, tokenIndex)
              const selectable = tokenSelectable(token, meaning)
              const picked = included?.tokenIndexes.includes(tokenIndex) ?? false
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
                  disabled={!included || !selectable}
                  key={tokenIndex}
                  onClick={() => onToggleToken(line.index, tokenIndex)}
                  type="button"
                >
                  <span className="block text-sm font-semibold">{token.surface}</span>
                  {selectable ? (
                    <span className={cn("block text-[10px]", picked ? "text-white/80" : "text-[#637083]")}>
                      {token.baseForm && token.baseForm !== token.surface ? `${token.baseForm} · ` : ""}
                      {meaning}
                      {token.jlpt ? ` · ${token.jlpt}` : ""}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {included ? (
            <>
              <div className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#637083]">Meanings</div>
              <div className="space-y-1">
                {line.tokens.map((token, tokenIndex) => {
                  if (token.surface.trim() === "" || !tokenTakesMeaning(token)) return null
                  const custom = included.meanings[tokenIndex]
                  return (
                    <div className="grid grid-cols-[72px_1fr_28px] items-center gap-x-2" key={tokenIndex}>
                      <span className="truncate text-sm font-semibold text-[#18212f]" title={token.surface}>
                        {token.surface}
                      </span>
                      <input
                        aria-label={`Meaning for ${token.surface}`}
                        className={cn(
                          "focus-ring h-7 w-full rounded-md border bg-white px-2 text-xs text-[#18212f]",
                          custom == null ? "border-[#cbd5e1]" : "border-[#0f766e]",
                        )}
                        onChange={(event) => onSetTokenMeaning(line.index, tokenIndex, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur()
                        }}
                        placeholder={token.koreanText ?? ""}
                        value={custom ?? token.koreanText ?? ""}
                      />
                      <Button
                        aria-label={`Reset meaning for ${token.surface}`}
                        className="h-7 w-7"
                        disabled={custom == null}
                        onClick={() => onSetTokenMeaning(line.index, tokenIndex, null)}
                        size="icon"
                        title="분석 결과의 뜻으로"
                        type="button"
                        variant="ghost"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </>
          ) : null}
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

/** 첫 배치와 키프레임 목록. 시각을 바로 고칠 수 있고, 슬라이더는 플레이헤드에 적용 중인 것을 고친다. */
function KeyframeList({
  track,
  active,
  clipStartMs,
  onAdd,
  onRemove,
  onSetTime,
  onSeek,
}: {
  track: MvTrack
  active: number
  clipStartMs: number
  onAdd(): void
  onRemove(index: number): void
  onSetTime(index: number, ms: number): void
  onSeek(ms: number): void
}) {
  const marker = (selected: boolean) => cn("h-6 w-1 shrink-0 rounded-full", selected ? "bg-[#7c3aed]" : "bg-transparent")
  return (
    <div className="mb-2 space-y-1">
      <button
        aria-label="Go to first frame"
        className={cn(
          "flex h-7 w-full items-center gap-2 rounded-md pr-2 font-mono text-xs",
          active < 0 ? "text-[#18212f]" : "text-[#42526b] hover:bg-[#eef2f6]",
        )}
        onClick={() => onSeek(clipStartMs)}
        type="button"
      >
        <span className={marker(active < 0)} />
        시작
      </button>
      {track.keyframes.map((keyframe, index) => (
        <div className="flex items-center gap-2" key={`${index}:${keyframe.atMs}`}>
          <span className={marker(active === index)} />
          <TimecodeInput ariaLabel={`Keyframe ${index + 1} time`} value={keyframe.atMs} onCommit={(ms) => onSetTime(index, ms)} />
          <Button
            aria-label={`Go to keyframe ${formatMs(keyframe.atMs)}`}
            className="h-7 w-7 shrink-0"
            onClick={() => onSeek(keyframe.atMs)}
            size="icon"
            title="키프레임으로 이동"
            type="button"
            variant="ghost"
          >
            <LocateFixed className="h-3.5 w-3.5" />
          </Button>
          <Button
            aria-label={`Remove keyframe ${formatMs(keyframe.atMs)}`}
            className="h-7 w-7 shrink-0"
            onClick={() => onRemove(index)}
            size="icon"
            title="키프레임 삭제"
            type="button"
            variant="ghost"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button className="h-7 w-full justify-start px-2 text-xs" onClick={onAdd} type="button" variant="ghost">
        <Plus className="mr-1 h-3.5 w-3.5" />
        플레이헤드에 키프레임
      </Button>
    </div>
  )
}

const SLIDER_GRID = "grid grid-cols-[48px_1fr_76px_28px] items-center gap-x-2 gap-y-1.5"

/** 슬라이더 한 줄. 라벨 · range · 값 · 초기화 순의 4칸을 부모 grid([SLIDER_GRID])에 그대로 깐다. */
function FrameSlider({
  label,
  ariaLabel = `MV ${label.toLowerCase()}`,
  defaultValue,
  min,
  max,
  step,
  value,
  disabled,
  factor = 1,
  digits = 0,
  suffix,
  onChange,
}: {
  label: string
  ariaLabel?: string
  defaultValue: number
  min: number
  max: number
  step: number
  value: number
  disabled?: boolean
  /** 입력칸에 보이는 수 = value × factor. 배율·크롭은 % 로 보여 준다. */
  factor?: number
  digits?: number
  suffix?: string
  onChange(value: number): void
}) {
  return (
    <>
      <span className="font-mono text-xs text-[#637083]">{label}</span>
      <input
        aria-label={ariaLabel}
        className="h-2 w-full cursor-pointer accent-[#0f766e] disabled:cursor-not-allowed"
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <NumberInput
        ariaLabel={`${ariaLabel} value`}
        digits={digits}
        disabled={disabled}
        suffix={suffix}
        value={value * factor}
        onCommit={(shown) => onChange(shown / factor)}
      />
      <Button
        aria-label={`Reset ${ariaLabel}`}
        className="h-7 w-7"
        disabled={disabled || Math.abs(value - defaultValue) < 1e-6}
        onClick={() => onChange(defaultValue)}
        size="icon"
        title="초기화"
        type="button"
        variant="ghost"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </>
  )
}

/** 상단 띠 헤드라인. 줄바꿈이 줄을 나누고 `<b>…</b>` 구간에 초록 배경이 깔린다 — 규칙은 placeholder 로만 보여 준다. */
function HeadlineInput({ value, onChange }: { value: string; onChange(value: string): void }) {
  return (
    <textarea
      aria-label="Headline"
      className="focus-ring min-h-[56px] w-full resize-y rounded-md border border-[#cbd5e1] bg-white px-2 py-1.5 text-sm leading-snug text-[#18212f]"
      onChange={(event) => onChange(event.target.value)}
      placeholder={"가사 한 줄에\n<b>일본어 단어 6개</b>"}
      rows={2}
      value={value}
    />
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
/** 슬라이더 옆 수치 입력. 타이핑 중엔 반영하지 않고 Enter·blur 에 넘긴다 — 범위 밖 값은 받는 쪽이 자른다. */
function NumberInput({
  ariaLabel,
  value,
  digits,
  disabled,
  suffix,
  onCommit,
}: {
  ariaLabel: string
  value: number
  digits: number
  disabled?: boolean
  suffix?: string
  onCommit(value: number): void
}) {
  const shown = value.toFixed(digits)
  const [text, setText] = React.useState(shown)
  const [editing, setEditing] = React.useState(false)
  // Escape 뒤의 blur 는 아직 고치기 전 text 를 보므로 그 한 번은 넘기지 않는다.
  const cancelled = React.useRef(false)
  React.useEffect(() => {
    if (!editing) setText(shown)
  }, [editing, shown])
  const commit = () => {
    setEditing(false)
    if (cancelled.current) {
      cancelled.current = false
      setText(shown)
      return
    }
    const parsed = Number(text)
    if (text.trim() === "" || !Number.isFinite(parsed)) {
      setText(shown)
      return
    }
    onCommit(parsed)
  }
  return (
    <div className="flex items-center gap-1">
      <input
        aria-label={ariaLabel}
        className="focus-ring h-7 w-full min-w-0 rounded-md border border-[#cbd5e1] bg-white px-1.5 text-right font-mono text-xs tabular-nums text-[#18212f] disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"
        disabled={disabled}
        inputMode="decimal"
        onBlur={commit}
        onChange={(event) => setText(event.target.value)}
        onFocus={() => setEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur()
          if (event.key === "Escape") {
            cancelled.current = true
            event.currentTarget.blur()
          }
        }}
        value={text}
      />
      {suffix ? <span className="w-4 shrink-0 font-mono text-[11px] text-[#637083]">{suffix}</span> : null}
    </div>
  )
}

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
