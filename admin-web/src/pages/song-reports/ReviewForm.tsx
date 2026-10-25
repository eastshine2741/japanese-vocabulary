import * as React from "react"
import { Plus, Scissors, Trash2 } from "lucide-react"
import { adminApi, ApiError } from "@/api/client"
import type { LyricToken, SongReportChangeOp, SongReportContext, SongReportDetail } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type OpKind = SongReportChangeOp["op"]

type DraftOp =
  | { key: number; op: "SET_YOUTUBE_URL" | "SET_LINE_TEXT" | "SET_LINE_TRANSLATION"; value: string }
  | { key: number; op: "SET_TOKEN_READING" | "SET_TOKEN_MEANING"; charStart: number; charEnd: number; value: string }
  | { key: number; op: "REPLACE_LINE_TOKENS"; tokens: LyricToken[] }

const opLabels: Record<OpKind, string> = {
  SET_YOUTUBE_URL: "MV 링크",
  SET_LINE_TEXT: "가사 원문",
  SET_LINE_TRANSLATION: "번역",
  SET_TOKEN_READING: "단어 발음",
  SET_TOKEN_MEANING: "단어 뜻",
  REPLACE_LINE_TOKENS: "단어 분리",
}

const defaultOpByType: Record<string, OpKind> = {
  LYRIC_TEXT: "SET_LINE_TEXT",
  FURIGANA: "SET_TOKEN_READING",
  TRANSLATION: "SET_LINE_TRANSLATION",
  WORD_MEANING: "SET_TOKEN_MEANING",
  SEGMENTATION: "REPLACE_LINE_TOKENS",
  MV_WRONG_SONG: "SET_YOUTUBE_URL",
  MV_OTHER_VERSION: "SET_YOUTUBE_URL",
  MV_LENGTH_MISMATCH: "SET_YOUTUBE_URL",
}

let nextKey = 1

function availableOps(context: SongReportContext): OpKind[] {
  const ops: OpKind[] = ["SET_YOUTUBE_URL"]
  if (!context.line) return ops
  ops.push("SET_LINE_TEXT", "SET_LINE_TRANSLATION")
  if (context.line.tokens.length > 0) ops.push("SET_TOKEN_READING", "SET_TOKEN_MEANING")
  ops.push("REPLACE_LINE_TOKENS")
  return ops
}

function tokenValue(op: OpKind, token: LyricToken | undefined) {
  return (op === "SET_TOKEN_READING" ? token?.reading : token?.koreanText) ?? ""
}

function createOp(kind: OpKind, report: SongReportDetail): DraftOp {
  const { context, target } = report
  const line = context.line
  const key = nextKey++
  switch (kind) {
    case "SET_YOUTUBE_URL":
      return { key, op: kind, value: context.song.youtubeUrl ?? "" }
    case "SET_LINE_TEXT":
      return { key, op: kind, value: line?.text ?? "" }
    case "SET_LINE_TRANSLATION":
      return { key, op: kind, value: line?.koreanLyrics ?? "" }
    case "REPLACE_LINE_TOKENS":
      return { key, op: kind, tokens: (line?.tokens ?? []).map((token) => ({ ...token })) }
    default: {
      const tokens = line?.tokens ?? []
      const token =
        tokens.find((item) => item.charStart === target?.charStart && item.charEnd === target?.charEnd) ?? tokens[0]
      return { key, op: kind, charStart: token?.charStart ?? 0, charEnd: token?.charEnd ?? 0, value: tokenValue(kind, token) }
    }
  }
}

function originalValue(draft: Exclude<DraftOp, { op: "REPLACE_LINE_TOKENS" }>, context: SongReportContext) {
  switch (draft.op) {
    case "SET_YOUTUBE_URL":
      return context.song.youtubeUrl ?? ""
    case "SET_LINE_TEXT":
      return context.line?.text ?? ""
    case "SET_LINE_TRANSLATION":
      return context.line?.koreanLyrics ?? ""
    default:
      return tokenValue(
        draft.op,
        context.line?.tokens.find((item) => item.charStart === draft.charStart && item.charEnd === draft.charEnd),
      )
  }
}

function toChangeOp(draft: DraftOp, lineIndex: number): SongReportChangeOp {
  switch (draft.op) {
    case "SET_YOUTUBE_URL":
      return { op: draft.op, value: draft.value.trim() }
    case "SET_LINE_TEXT":
    case "SET_LINE_TRANSLATION":
      return { op: draft.op, lineIndex, value: draft.value }
    case "SET_TOKEN_READING":
    case "SET_TOKEN_MEANING":
      return { op: draft.op, lineIndex, charStart: draft.charStart, charEnd: draft.charEnd, value: draft.value }
    case "REPLACE_LINE_TOKENS":
      return {
        op: draft.op,
        lineIndex,
        tokens: draft.tokens.map((item) => ({
          ...item,
          reading: item.reading || null,
          baseFormReading: item.baseFormReading || null,
          koreanText: item.koreanText || null,
          jlpt: item.jlpt || null,
        })),
      }
  }
}

export function ReviewForm({
  report,
  token,
  onReviewed,
}: {
  report: SongReportDetail
  token: string
  onReviewed(report: SongReportDetail): void
}) {
  const { context } = report
  const choices = availableOps(context)
  const suggested = choices.find((kind) => kind === defaultOpByType[report.type])
  const [ops, setOps] = React.useState<DraftOp[]>(() => (suggested ? [createOp(suggested, report)] : []))
  const [adding, setAdding] = React.useState<OpKind>(suggested ?? choices[0])
  const [note, setNote] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const lineText = React.useMemo(() => {
    const edited = [...ops].reverse().find((item) => item.op === "SET_LINE_TEXT")
    return edited && "value" in edited ? edited.value : (context.line?.text ?? "")
  }, [ops, context.line])

  const updateOp = React.useCallback((key: number, next: DraftOp) => {
    setOps((current) => current.map((item) => (item.key === key ? next : item)))
  }, [])
  const removeOp = React.useCallback((key: number) => {
    setOps((current) => current.filter((item) => item.key !== key))
  }, [])

  async function submit(decision: "approve" | "reject") {
    setSubmitting(true)
    setError(null)
    const trimmedNote = note.trim() || undefined
    try {
      const result =
        decision === "approve"
          ? await adminApi.approveSongReport(token, report.id, {
              changes: ops.map((item) => toChangeOp(item, context.line?.index ?? 0)),
              note: trimmedNote,
            })
          : await adminApi.rejectSongReport(token, report.id, { note: trimmedNote })
      onReviewed(result)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Request failed")
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3" role="group" aria-label="Review">
      {ops.length > 0 ? (
        <div className="divide-y divide-[#edf1f5] rounded-md border border-[#d9e1ea]">
          {ops.map((item) => (
            <OpEditor
              key={item.key}
              draft={item}
              context={context}
              lineText={lineText}
              suggestion={report.suggestion}
              onChange={updateOp}
              onRemove={removeOp}
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="focus-ring h-9 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"
          value={adding}
          onChange={(event) => setAdding(event.target.value as OpKind)}
          aria-label="Change type"
        >
          {choices.map((kind) => (
            <option key={kind} value={kind}>
              {opLabels[kind]}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => setOps((current) => [...current, createOp(adding, report)])}>
          <Plus className="h-4 w-4" />
          Add change
        </Button>
      </div>
      <div className="space-y-3 border-t border-[#edf1f5] pt-3">
        <Input
          value={note}
          maxLength={500}
          placeholder="Note (optional)"
          aria-label="Review note"
          onChange={(event) => setNote(event.target.value)}
        />
        {error ? (
          <div role="alert" className="rounded-md border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-sm text-[#991b1b]">
            {error}
          </div>
        ) : null}
        <div className="flex gap-2">
          <Button disabled={submitting} onClick={() => submit("approve")}>
            Approve{ops.length > 0 ? ` (${ops.length})` : ""}
          </Button>
          <Button variant="secondary" disabled={submitting} onClick={() => submit("reject")}>
            Reject
          </Button>
        </div>
      </div>
    </div>
  )
}

const OpEditor = React.memo(function OpEditor({
  draft,
  context,
  lineText,
  suggestion,
  onChange,
  onRemove,
}: {
  draft: DraftOp
  context: SongReportContext
  lineText: string
  suggestion: string | null
  onChange(key: number, next: DraftOp): void
  onRemove(key: number): void
}) {
  const tokens = context.line?.tokens ?? []
  const original = draft.op === "REPLACE_LINE_TOKENS" ? null : originalValue(draft, context)
  return (
    <div className="space-y-2 px-3 py-3" aria-label={opLabels[draft.op]}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#18212f]">
          {opLabels[draft.op]}
          {context.line && draft.op !== "SET_YOUTUBE_URL" ? (
            <span className="ml-2 font-normal text-[#637083]">line {context.line.index}</span>
          ) : null}
        </span>
        <Button variant="ghost" size="icon" aria-label={`Remove ${opLabels[draft.op]}`} title="Remove" onClick={() => onRemove(draft.key)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {draft.op === "REPLACE_LINE_TOKENS" ? (
        <TokenRows lineText={lineText} tokens={draft.tokens} onChange={(next) => onChange(draft.key, { ...draft, tokens: next })} />
      ) : (
        <>
          {draft.op === "SET_TOKEN_READING" || draft.op === "SET_TOKEN_MEANING" ? (
            <div className="flex flex-wrap gap-1">
              {tokens.map((item) => {
                const selected = item.charStart === draft.charStart && item.charEnd === draft.charEnd
                return (
                  <button
                    key={`${item.charStart}-${item.charEnd}`}
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      "focus-ring rounded-md border px-2 py-1 text-sm",
                      selected ? "border-[#0f766e] bg-[#e6fffb] text-[#0f766e]" : "border-[#cbd5e1] bg-white",
                    )}
                    onClick={() =>
                      onChange(draft.key, {
                        ...draft,
                        charStart: item.charStart,
                        charEnd: item.charEnd,
                        value: tokenValue(draft.op, item),
                      })
                    }
                  >
                    {item.surface}
                  </button>
                )
              })}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Input
              value={draft.value}
              aria-label={`${opLabels[draft.op]} value`}
              onChange={(event) => onChange(draft.key, { ...draft, value: event.target.value })}
            />
            {suggestion && suggestion !== draft.value ? (
              <Button variant="secondary" onClick={() => onChange(draft.key, { ...draft, value: suggestion })}>
                Use suggestion
              </Button>
            ) : null}
          </div>
          <div className="text-xs text-[#637083]">
            Current: <span className="text-[#42526b]">{original || "-"}</span>
            {original === draft.value ? <span className="ml-2 text-[#b45309]">unchanged</span> : null}
          </div>
        </>
      )}
    </div>
  )
})

const blankToken: LyricToken = {
  surface: "",
  baseForm: "",
  reading: null,
  baseFormReading: null,
  partOfSpeech: "",
  charStart: 0,
  charEnd: 0,
  koreanText: null,
  jlpt: null,
}

const tokenFields: { key: keyof LyricToken; label: string; width: string }[] = [
  { key: "surface", label: "surface", width: "w-20" },
  { key: "reading", label: "reading", width: "w-24" },
  { key: "baseForm", label: "baseForm", width: "w-20" },
  { key: "baseFormReading", label: "baseFormReading", width: "w-24" },
  { key: "partOfSpeech", label: "partOfSpeech", width: "w-28" },
  { key: "koreanText", label: "koreanText", width: "w-28" },
  { key: "jlpt", label: "jlpt", width: "w-14" },
]

function TokenRows({
  lineText,
  tokens,
  onChange,
}: {
  lineText: string
  tokens: LyricToken[]
  onChange(next: LyricToken[]): void
}) {
  const patch = (index: number, change: Partial<LyricToken>) =>
    onChange(tokens.map((item, i) => (i === index ? { ...item, ...change } : item)))

  function split(index: number) {
    const token = tokens[index]
    const at = Math.max(1, Math.floor(token.surface.length / 2))
    const head = { ...token, surface: token.surface.slice(0, at), charEnd: token.charStart + at }
    const tail = { ...token, surface: token.surface.slice(at), charStart: token.charStart + at, reading: null, koreanText: null }
    onChange([...tokens.slice(0, index), head, tail, ...tokens.slice(index + 1)])
  }

  function add() {
    const end = tokens.reduce((max, item) => Math.max(max, item.charEnd), 0)
    onChange([...tokens, { ...blankToken, charStart: end, charEnd: end }])
  }

  return (
    <div className="space-y-1 overflow-x-auto">
      {tokens.map((item, index) => {
        const matches = lineText.slice(item.charStart, item.charEnd) === item.surface
        return (
          <div key={index} className="flex items-center gap-1" role="group" aria-label={`Token ${index + 1}`}>
            <Input
              type="number"
              className="w-16"
              aria-label="charStart"
              value={item.charStart}
              onChange={(event) => patch(index, { charStart: Number(event.target.value) })}
            />
            <Input
              type="number"
              className="w-16"
              aria-label="charEnd"
              value={item.charEnd}
              onChange={(event) => patch(index, { charEnd: Number(event.target.value) })}
            />
            {tokenFields.map((field) => (
              <Input
                key={field.key}
                className={field.width}
                aria-label={field.label}
                placeholder={field.label}
                value={(item[field.key] as string | null | undefined) ?? ""}
                onChange={(event) => patch(index, { [field.key]: event.target.value })}
              />
            ))}
            <span
              className={cn("w-6 text-center text-sm font-semibold", matches ? "text-[#0f766e]" : "text-[#991b1b]")}
              role="status"
              aria-label={matches ? "offset ok" : "offset mismatch"}
              title={matches ? "text matches surface" : `text: ${lineText.slice(item.charStart, item.charEnd)}`}
            >
              {matches ? "✓" : "✗"}
            </span>
            <Button variant="ghost" size="icon" aria-label="Split token" title="Split" onClick={() => split(index)}>
              <Scissors className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove token"
              title="Remove"
              onClick={() => onChange(tokens.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      })}
      <Button variant="secondary" onClick={add}>
        <Plus className="h-4 w-4" />
        Add token
      </Button>
    </div>
  )
}
