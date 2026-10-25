import * as React from "react"
import { RotateCcw } from "lucide-react"
import { adminApi } from "@/api/client"
import type { SongAnalysisStage, SongAnalysisWorkDetail } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, formatDurationMillis } from "@/lib/utils"

// Mirrors SongAnalysisWorkStage.dependsOn: lyrics run as a chain, the MV search joins only at COMPLETE.
const LYRIC_CHAIN = ["FETCH_LYRICS", "ANALYZE_LYRICS", "SELECT_SENSES", "TRANSLATE_SENSES", "COMPLETE"]
const LEGACY_STAGE = "CREATE_SONG_AND_LYRIC"

export function StageGraph({
  work,
  token,
  onRerun,
}: {
  work: SongAnalysisWorkDetail
  token: string
  onRerun: (stage: string) => Promise<void>
}) {
  const byStage = new Map(work.stages.map((stage) => [stage.stage, stage]))
  const hasLegacy = byStage.has(LEGACY_STAGE)
  const [openOutput, setOpenOutput] = React.useState<{ stage: string; text: string | null; state: "loading" | "open" | "error" } | null>(null)
  const [rerunning, setRerunning] = React.useState<string | null>(null)

  async function toggleOutput(stage: string) {
    if (openOutput?.stage === stage) {
      setOpenOutput(null)
      return
    }
    setOpenOutput({ stage, text: null, state: "loading" })
    try {
      const body = await adminApi.songAnalysisStageOutput(token, String(work.id), stage)
      setOpenOutput({ stage, text: JSON.stringify(body, null, 2), state: "open" })
    } catch {
      setOpenOutput({ stage, text: null, state: "error" })
    }
  }

  async function rerun(stage: string) {
    setRerunning(stage)
    try {
      await onRerun(stage)
    } finally {
      setRerunning(null)
    }
  }

  const node = (stage: string) => (
    <StageNode
      stage={stage}
      row={byStage.get(stage)}
      inherited={work.sourceWorkId != null && byStage.get(stage)?.attempt === 0}
      sourceWorkId={work.sourceWorkId}
      blocker={stage in work.rerunBlockers ? work.rerunBlockers[stage] : "Legacy stage"}
      outputOpen={openOutput?.stage === stage && openOutput.state === "open"}
      rerunning={rerunning === stage}
      onToggleOutput={() => toggleOutput(stage)}
      onRerun={() => rerun(stage)}
    />
  )

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[72rem] grid-cols-[repeat(4,minmax(0,1fr)_1.5rem)_minmax(0,1fr)] items-stretch gap-y-3">
          {LYRIC_CHAIN.map((stage, index) => (
            <React.Fragment key={stage}>
              {node(stage)}
              {index < LYRIC_CHAIN.length - 1 ? <Arrow /> : null}
            </React.Fragment>
          ))}

          {node("FETCH_YOUTUBE")}
          {hasLegacy ? (
            <>
              <Arrow />
              {node(LEGACY_STAGE)}
              <JoinLine span={5} />
            </>
          ) : (
            <JoinLine span={7} />
          )}
          <Elbow />
        </div>
      </div>
      {openOutput && openOutput.state !== "loading" ? (
        <div className="mt-3 border-y border-[#d9e1ea] bg-[#f6f7f9] px-4 py-3">
          <div className="mb-2 text-xs font-semibold text-[#637083]">{openOutput.stage} output</div>
          {openOutput.state === "error" ? (
            <span className="text-sm text-[#b91c1c]">Could not load output.</span>
          ) : (
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-all text-xs text-[#18212f]">{openOutput.text}</pre>
          )}
        </div>
      ) : null}
    </div>
  )
}

function StageNode({
  stage,
  row,
  inherited,
  sourceWorkId,
  blocker,
  outputOpen,
  rerunning,
  onToggleOutput,
  onRerun,
}: {
  stage: string
  row: SongAnalysisStage | undefined
  inherited: boolean
  sourceWorkId: number | null
  blocker: string | null
  outputOpen: boolean
  rerunning: boolean
  onToggleOutput: () => void
  onRerun: () => void
}) {
  return (
    <div
      data-testid={`stage-${stage}`}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-md border bg-white px-3 py-3",
        row?.status === "FAILED" ? "border-[#fecaca]" : "border-[#d9e1ea]",
        !row && "border-dashed",
      )}
    >
      <div className="truncate text-xs font-semibold text-[#18212f]">{stage}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#637083]">
        <Badge tone={statusTone(row?.status)}>{row?.status ?? "NOT RUN"}</Badge>
        {inherited ? <span>from #{sourceWorkId}</span> : row ? <span>attempt {row.attempt}</span> : null}
        {row && !inherited ? <span>{formatDurationBetween(row.startedAt, row.finishedAt)}</span> : null}
      </div>
      {row?.errorCode ? (
        <div className="break-words text-xs text-[#991b1b]" title={[row.errorClass, row.errorMessage].filter(Boolean).join("\n")}>
          <div className="font-semibold">{row.errorCode}</div>
          <div className="line-clamp-2">{row.errorMessage}</div>
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2">
        {row?.outputLength ? (
          <Button variant="secondary" onClick={onToggleOutput}>
            {outputOpen ? "Hide" : `View (${row.outputLength.toLocaleString()} chars)`}
          </Button>
        ) : null}
        <span title={blocker ?? undefined}>
          <Button
            variant="secondary"
           
            aria-label={`Rerun ${stage}`}
            disabled={blocker != null || rerunning}
            onClick={onRerun}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {rerunning ? "Rerunning..." : "Rerun"}
          </Button>
        </span>
      </div>
    </div>
  )
}

function Arrow() {
  return (
    <div aria-hidden className="flex items-center">
      <div className="h-px flex-1 bg-[#94a3b8]" />
      <div className="h-0 w-0 border-y-4 border-l-[6px] border-y-transparent border-l-[#94a3b8]" />
    </div>
  )
}

function JoinLine({ span }: { span: number }) {
  return (
    <div aria-hidden className="flex items-center" style={{ gridColumn: `span ${span} / span ${span}` }}>
      <div className="h-px w-full bg-[#94a3b8]" />
    </div>
  )
}

// The MV row turns up into COMPLETE, which sits in the column above.
function Elbow() {
  return (
    <div aria-hidden className="relative">
      <div className="absolute left-0 right-1/2 top-1/2 h-px bg-[#94a3b8]" />
      <div className="absolute -top-3 bottom-1/2 left-1/2 w-px bg-[#94a3b8]" />
    </div>
  )
}

function formatDurationBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return "-"
  return formatDurationMillis(Math.max(0, new Date(end).getTime() - new Date(start).getTime()))
}

function statusTone(status?: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "COMPLETED") return "success"
  if (status === "FAILED") return "danger"
  if (status === "RUNNING") return "warning"
  return "neutral"
}
