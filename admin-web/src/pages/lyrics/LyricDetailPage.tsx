import * as React from "react"
import { Check, Copy, MousePointer2 } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { AnalyzedLyricLine, LyricDetail, LyricToken, RawLyricLine } from "@/api/types"
import { DetailGrid, DetailItem } from "@/components/DetailGrid"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/PageHeader"
import { useAuth } from "@/features/auth"
import { cn, formatDateTime } from "@/lib/utils"

const NO_UNDERLINE_POS = new Set(["SYMBOL", "SUPPLEMENTARY_SYMBOL", "WHITESPACE"])
const KANJI_RE = /[一-鿿]/

const POS_COLORS: Record<string, string> = {
  NOUN: "#5B8FCC",
  VERB: "#4A9D7A",
  ADJECTIVE: "#E89B3E",
  NA_ADJECTIVE: "#E89B3E",
  ADVERB: "#9D7AC4",
  PRONOUN: "#5B8FCC",
  ADNOMINAL: "#5B8FCC",
  CONJUNCTION: "#5B8FCC",
  AUXILIARY_VERB: "#4A9D7A",
  PARTICLE: "#E07595",
  INTERJECTION: "#5B8FCC",
  PREFIX: "#5B8FCC",
  SUFFIX: "#5B8FCC",
  EXPRESSION: "#5B8FCC",
  FILLER: "#888888",
  OTHER: "#888888",
}

const POS_LABELS: Record<string, string> = {
  NOUN: "명사",
  VERB: "동사",
  ADJECTIVE: "형용사",
  NA_ADJECTIVE: "형용동사",
  ADVERB: "부사",
  PRONOUN: "대명사",
  ADNOMINAL: "연체사",
  CONJUNCTION: "접속사",
  AUXILIARY_VERB: "조동사",
  PARTICLE: "조사",
  INTERJECTION: "감동사",
  PREFIX: "접두사",
  SUFFIX: "접미사",
  EXPRESSION: "표현",
  FILLER: "필러",
  OTHER: "기타",
  SYMBOL: "기호",
  SUPPLEMENTARY_SYMBOL: "보조기호",
  WHITESPACE: "공백",
}

type SelectedToken = {
  key: string
  token: LyricToken
  tokenIndex: number
  rawLine: RawLyricLine
  analyzedLine: AnalyzedLyricLine
}

export function LyricDetailPage() {
  const { token } = useAuth()
  const { lyricId = "" } = useParams()
  const [lyric, setLyric] = React.useState<LyricDetail | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")
  const [copiedTarget, setCopiedTarget] = React.useState<"raw" | "analyzed" | null>(null)

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .lyric(token!, lyricId)
      .then((result) => {
        if (!alive) return
        setLyric(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [lyricId, token])

  const handleCopy = React.useCallback(async (target: "raw" | "analyzed", value: unknown) => {
    await copyText(JSON.stringify(value, null, 2))
    setCopiedTarget(target)
    window.setTimeout(() => setCopiedTarget(null), 1400)
  }, [])

  if (state === "loading") return <LoadingState />
  if (state === "error" || !lyric) return <ErrorState label="Could not load lyric." />

  return (
    <>
      <PageHeader title={`Lyric #${lyric.id}`} meta={`${lyric.rawContent.length} raw lines`} />
      <DetailGrid>
        <DetailItem label="Song" value={<Link className="text-[#0f766e] hover:underline" to={`/songs/${lyric.songId}`}>{lyric.songId}</Link>} />
        <DetailItem label="Type" value={lyric.lyricType} />
        <DetailItem label="LRCLIB" value={lyric.lrclibId ?? "-"} />
        <DetailItem label="VocaDB" value={lyric.vocadbId ?? "-"} />
        <DetailItem label="Created" value={formatDateTime(lyric.createdAt)} />
        <DetailItem label="Updated" value={formatDateTime(lyric.updatedAt)} />
      </DetailGrid>
      <section className="mt-6 border-y border-[#d9e1ea] bg-white">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#18212f]">Content export</h2>
            <p className="mt-1 text-xs text-[#637083]">JSON 원문은 화면에 표시하지 않고 필요할 때 클립보드로 복사합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton copied={copiedTarget === "raw"} label="Copy raw JSON" onClick={() => void handleCopy("raw", lyric.rawContent)} />
            <CopyButton copied={copiedTarget === "analyzed"} label="Copy analyzed JSON" onClick={() => void handleCopy("analyzed", lyric.analyzedContent)} />
          </div>
        </div>
      </section>
      <section className="mt-6">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#18212f]">Analyzed lyrics</h2>
            <p className="text-xs text-[#637083]">품사 밑줄, 읽기, 한국어 해석을 앱 화면과 같은 구조로 확인합니다.</p>
          </div>
          <span className="font-mono text-xs text-[#637083]">{lyric.analyzedContent?.length ?? 0} lines</span>
        </div>
        <AnalyzedLyricsView rawContent={lyric.rawContent} analyzedContent={lyric.analyzedContent} />
      </section>
    </>
  )
}

function CopyButton({ copied, label, onClick }: { copied: boolean; label: string; onClick: () => void }) {
  const Icon = copied ? Check : Copy
  return (
    <Button type="button" variant="secondary" className="h-8 px-2.5 text-xs" onClick={onClick} aria-label={label} title={label}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span>{copied ? "Copied" : label}</span>
    </Button>
  )
}

function AnalyzedLyricsView({
  rawContent,
  analyzedContent,
}: {
  rawContent: RawLyricLine[]
  analyzedContent: AnalyzedLyricLine[] | null
}) {
  const [selectedToken, setSelectedToken] = React.useState<SelectedToken | null>(null)

  const lines = React.useMemo(() => {
    const analyzedByIndex = new Map((analyzedContent ?? []).map((line) => [line.index, line]))
    return rawContent.map((rawLine) => ({
      rawLine,
      analyzedLine: analyzedByIndex.get(rawLine.index),
    }))
  }, [analyzedContent, rawContent])

  React.useEffect(() => {
    setSelectedToken(null)
  }, [analyzedContent, rawContent])

  if (!analyzedContent || analyzedContent.length === 0) {
    return (
      <div className="border-y border-[#d9e1ea] bg-white px-4 py-10 text-center text-sm text-[#637083]">
        분석된 가사가 없습니다.
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="max-h-[680px] overflow-auto border-y border-[#d9e1ea] bg-[#fbfcfd]">
        {lines.map(({ rawLine, analyzedLine }) => (
          <LyricPreviewLine
            key={rawLine.index}
            rawLine={rawLine}
            analyzedLine={analyzedLine}
            selectedKey={selectedToken?.key ?? null}
            onTokenSelect={setSelectedToken}
          />
        ))}
      </div>
      <WordInspector selectedToken={selectedToken} />
    </div>
  )
}

function LyricPreviewLine({
  rawLine,
  analyzedLine,
  selectedKey,
  onTokenSelect,
}: {
  rawLine: RawLyricLine
  analyzedLine?: AnalyzedLyricLine
  selectedKey: string | null
  onTokenSelect: (selectedToken: SelectedToken) => void
}) {
  return (
    <article className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-b border-[#e7edf3] bg-white px-4 py-5 last:border-b-0 sm:grid-cols-[5rem_minmax(0,1fr)] sm:px-6">
      <div className="pt-2 font-mono text-xs text-[#8a95a5]">
        <div>#{rawLine.index}</div>
        {rawLine.startTimeMs != null ? <div className="mt-1">{formatTime(rawLine.startTimeMs)}</div> : null}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-end gap-x-1.5 gap-y-3">
          {renderTokens(rawLine, analyzedLine, selectedKey, onTokenSelect)}
        </div>
        {analyzedLine?.koreanPronounciation ? (
          <p className="mt-3 text-sm text-[#637083]">{analyzedLine.koreanPronounciation}</p>
        ) : null}
        {analyzedLine?.koreanLyrics ? (
          <p className="mt-1 text-sm font-medium leading-6 text-[#18212f]">{analyzedLine.koreanLyrics}</p>
        ) : (
          <p className="mt-3 text-sm text-[#8a95a5]">해석 없음</p>
        )}
      </div>
    </article>
  )
}

function renderTokens(
  rawLine: RawLyricLine,
  analyzedLine: AnalyzedLyricLine | undefined,
  selectedKey: string | null,
  onTokenSelect: (selectedToken: SelectedToken) => void,
) {
  const tokens = analyzedLine?.tokens ?? []
  if (tokens.length === 0) {
    return <span className="text-lg font-medium leading-8 text-[#18212f]">{rawLine.text}</span>
  }

  const elements: React.ReactNode[] = []
  let cursor = 0

  tokens.forEach((token, index) => {
    if (token.charStart > cursor) {
      elements.push(
        <span key={`gap-${index}`} className="text-lg font-medium leading-8 text-[#18212f]">
          {rawLine.text.slice(cursor, token.charStart)}
        </span>,
      )
    }
    const tokenKey = `${rawLine.index}:${index}:${token.charStart}:${token.charEnd}`
    elements.push(
      <TokenView
        key={`token-${index}`}
        tokenKey={tokenKey}
        token={token}
        isSelected={selectedKey === tokenKey}
        onSelect={() => analyzedLine && onTokenSelect({ key: tokenKey, token, tokenIndex: index, rawLine, analyzedLine })}
      />,
    )
    cursor = Math.max(cursor, token.charEnd)
  })

  if (cursor < rawLine.text.length) {
    elements.push(
      <span key="tail" className="text-lg font-medium leading-8 text-[#18212f]">
        {rawLine.text.slice(cursor)}
      </span>,
    )
  }

  return elements
}

function TokenView({
  tokenKey,
  token,
  isSelected,
  onSelect,
}: {
  tokenKey: string
  token: LyricToken
  isSelected: boolean
  onSelect: () => void
}) {
  const underlineColor = getUnderlineColor(token.partOfSpeech)
  const furigana = token.reading && KANJI_RE.test(token.surface) ? katakanaToHiragana(token.reading) : null
  const titleParts = [POS_LABELS[token.partOfSpeech] ?? token.partOfSpeech, token.koreanText, token.baseForm !== token.surface ? token.baseForm : null]
    .filter(Boolean)
    .join(" · ")

  if (!underlineColor) {
    return (
      <span title={titleParts} className="relative inline-flex min-h-9 flex-col items-center justify-end px-0.5">
        {furigana ? <span className="mb-0.5 text-[11px] leading-none text-[#637083]">{furigana}</span> : null}
        <span className="text-lg font-semibold leading-8 text-[#18212f]">{token.surface}</span>
      </span>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        "focus-ring relative inline-flex min-h-9 flex-col items-center justify-end rounded px-1 transition-colors hover:bg-[#eef7f5]",
        isSelected ? "bg-[#e3f4ef]" : "",
      )}
      aria-pressed={isSelected}
      aria-label={`Inspect ${token.surface}`}
      data-token-key={tokenKey}
      onClick={onSelect}
      title={titleParts}
    >
      {furigana ? <span className="mb-0.5 text-[11px] leading-none text-[#637083]">{furigana}</span> : null}
      <span className="text-lg font-semibold leading-8 text-[#18212f]">{token.surface}</span>
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full"
        style={{ backgroundColor: underlineColor }}
      />
    </button>
  )
}

function WordInspector({ selectedToken }: { selectedToken: SelectedToken | null }) {
  if (!selectedToken) {
    return (
      <aside className="border-y border-[#d9e1ea] bg-white p-5 lg:sticky lg:top-4 lg:self-start">
        <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e8f3f1] text-[#0f766e]">
            <MousePointer2 aria-hidden="true" className="h-5 w-5" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-[#18212f]">Select a word</h3>
          <p className="mt-1 max-w-60 text-xs leading-5 text-[#637083]">
            밑줄이 있는 단어를 클릭하면 뜻, 품사, reading, 라인 맥락을 검수할 수 있습니다.
          </p>
        </div>
      </aside>
    )
  }

  const { token, rawLine, analyzedLine, tokenIndex } = selectedToken
  const posColor = getUnderlineColor(token.partOfSpeech) ?? "#8a95a5"
  const reading = token.reading ? katakanaToHiragana(token.reading) : null
  const baseReading = token.baseFormReading ? katakanaToHiragana(token.baseFormReading) : null

  return (
    <aside className="border-y border-[#d9e1ea] bg-white lg:sticky lg:top-4 lg:self-start" aria-live="polite">
      <div className="border-b border-[#edf1f5] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-[#8a95a5]">Line #{rawLine.index} · Token {tokenIndex + 1}</p>
            <h3 className="mt-1 break-words text-2xl font-semibold leading-tight text-[#18212f]">{token.surface}</h3>
          </div>
          <span
            className="shrink-0 rounded px-2 py-1 text-xs font-semibold"
            style={{ backgroundColor: `${posColor}22`, color: posColor }}
          >
            {POS_LABELS[token.partOfSpeech] ?? token.partOfSpeech}
          </span>
        </div>
        <div className="mt-4 border-l-4 py-2 pl-3" style={{ borderColor: posColor }}>
          <p className="text-xs font-semibold uppercase tracking-normal text-[#637083]">Meaning</p>
          <p className={cn("mt-1 text-base font-semibold text-[#18212f]", !token.koreanText && "text-[#8a95a5]")}>
            {token.koreanText || "뜻 없음"}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 border-b border-[#edf1f5] text-sm">
        <InspectorItem label="Base form" value={token.baseForm} />
        <InspectorItem label="JLPT" value={token.jlpt ?? "-"} />
        <InspectorItem label="Reading" value={reading ?? token.reading ?? "-"} />
        <InspectorItem label="Base reading" value={baseReading ?? token.baseFormReading ?? "-"} />
        <InspectorItem label="Char range" value={`${token.charStart}-${token.charEnd}`} />
        <InspectorItem label="POS key" value={token.partOfSpeech} />
      </dl>

      <div className="space-y-4 px-5 py-4">
        <ContextBlock label="Original line" value={highlightToken(rawLine.text, token.charStart, token.charEnd)} />
        {analyzedLine.koreanPronounciation ? (
          <ContextBlock label="Pronunciation" value={analyzedLine.koreanPronounciation} />
        ) : null}
        <ContextBlock label="Translation" value={analyzedLine.koreanLyrics || "해석 없음"} />
      </div>
    </aside>
  )
}

function InspectorItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 border-b border-r border-[#edf1f5] px-4 py-3 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
      <dt className="text-[11px] font-semibold uppercase tracking-normal text-[#637083]">{label}</dt>
      <dd className="mt-1 break-words font-medium text-[#18212f]">{value}</dd>
    </div>
  )
}

function ContextBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-normal text-[#637083]">{label}</p>
      <p className="mt-1 break-words text-sm leading-6 text-[#18212f]">{value}</p>
    </div>
  )
}

function highlightToken(text: string, start: number, end: number) {
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded bg-[#fff1b8] px-0.5 text-[#18212f]">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
}

function getUnderlineColor(partOfSpeech: string) {
  if (NO_UNDERLINE_POS.has(partOfSpeech)) return null
  return POS_COLORS[partOfSpeech] ?? "#5B8FCC"
}

function katakanaToHiragana(value: string) {
  return value.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.top = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}
