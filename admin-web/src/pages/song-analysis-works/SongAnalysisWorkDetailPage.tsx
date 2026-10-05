import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { RotateCcw } from "lucide-react"
import { adminApi } from "@/api/client"
import type { SongAnalysisStage, SongAnalysisWorkDetail } from "@/api/types"
import { DetailGrid, DetailItem } from "@/components/DetailGrid"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, Td, Th } from "@/components/ui/table"
import { PageHeader } from "@/components/PageHeader"
import { useAuth } from "@/features/auth"
import { formatDateTime, formatDurationMillis } from "@/lib/utils"

export function SongAnalysisWorkDetailPage() {
  const { token } = useAuth()
  const { workId = "" } = useParams()
  const [work, setWork] = React.useState<SongAnalysisWorkDetail | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")
  const [resumeState, setResumeState] = React.useState<"idle" | "submitting" | "error">("idle")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .songAnalysisWork(token!, workId)
      .then((result) => {
        if (!alive) return
        setWork(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [workId, token])

  async function resume() {
    if (!token || !work) return
    setResumeState("submitting")
    try {
      setWork(await adminApi.resumeSongAnalysisWork(token, String(work.id)))
      setResumeState("idle")
    } catch {
      setResumeState("error")
    }
  }

  if (state === "loading") return <LoadingState />
  if (state === "error" || !work) return <ErrorState label="Could not load song analysis work." />

  return (
    <>
      <PageHeader
        title={`Work #${work.id}`}
        meta={
          <div className="flex items-center gap-3">
            <Badge tone={statusTone(work.status)}>{work.status}</Badge>
            {work.resumable ? (
              <Button onClick={resume} disabled={resumeState === "submitting"}>
                <RotateCcw className="h-4 w-4" />
                {resumeState === "submitting" ? "Resuming..." : `Resume from ${work.currentStage}`}
              </Button>
            ) : null}
          </div>
        }
      />
      {resumeState === "error" ? <p className="mb-4 text-sm text-[#b91c1c]">Could not resume this work.</p> : null}
      <DetailGrid>
        <DetailItem label="Title" value={work.rawTitle} />
        <DetailItem label="Artist" value={work.rawArtist} />
        <DetailItem label="Current stage" value={work.currentStage ?? "-"} />
        <DetailItem label="Trigger" value={work.triggerSource} />
        <DetailItem label="Song" value={work.songId ? <Link className="text-[#0f766e] hover:underline" to={`/songs/${work.songId}`}>{work.songId}</Link> : "-"} />
        <DetailItem label="Lyric" value={work.lyricId ? <Link className="text-[#0f766e] hover:underline" to={`/lyrics/${work.lyricId}`}>{work.lyricId}</Link> : "-"} />
        <DetailItem label="Duration" value={work.durationSeconds ? `${work.durationSeconds}s` : "-"} />
        <DetailItem label="Created by user" value={work.createdByUserId ?? "-"} />
      </DetailGrid>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[#18212f]">Milestones</h2>
        <DetailGrid>
          <DetailItem label="Created" value={formatDateTime(work.createdAt)} />
          <DetailItem label="Completed" value={formatDateTime(work.completedAt)} />
          <DetailItem label="Failed" value={formatDateTime(work.failedAt)} />
          <DetailItem label="Updated" value={formatDateTime(work.updatedAt)} />
          <DetailItem label="This run started" value={formatDateTime(work.startedAt)} />
        </DetailGrid>
      </section>

      {work.stages.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-[#18212f]">Stages</h2>
          <Table>
            <thead>
              <tr>
                <Th>Stage</Th>
                <Th>Status</Th>
                <Th>Attempt</Th>
                <Th>Took</Th>
                <Th>Error</Th>
                <Th>Output</Th>
              </tr>
            </thead>
            <tbody>
              {work.stages.map((stage) => (
                <StageRow key={stage.stage} workId={work.id} stage={stage} token={token!} />
              ))}
            </tbody>
          </Table>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[#18212f]">Elapsed time</h2>
        <DetailGrid>
          <DetailItem label="Created to terminal" value={formatDurationBetween(work.createdAt, terminalAt(work))} />
          <DetailItem label="Last update from created" value={formatDurationBetween(work.createdAt, work.updatedAt)} />
        </DetailGrid>
      </section>

      {work.errorCode || work.errorMessage ? (
        <section className="mt-6 border-y border-[#fecaca] bg-[#fff7f7] px-4 py-4">
          <h2 className="text-sm font-semibold text-[#991b1b]">Failure</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
            <dt className="font-semibold text-[#7f1d1d]">Code</dt>
            <dd className="break-words text-[#18212f]">{work.errorCode ?? "-"}</dd>
            <dt className="font-semibold text-[#7f1d1d]">Message</dt>
            <dd className="break-words text-[#18212f]">{work.errorMessage ?? "-"}</dd>
          </dl>
        </section>
      ) : null}
    </>
  )
}

const StageRow = React.memo(function StageRow({ workId, stage, token }: { workId: number; stage: SongAnalysisStage; token: string }) {
  const [output, setOutput] = React.useState<string | null>(null)
  const [outputState, setOutputState] = React.useState<"closed" | "loading" | "open" | "error">("closed")

  const toggleOutput = React.useCallback(async () => {
    if (outputState === "open") {
      setOutputState("closed")
      return
    }
    setOutputState("loading")
    try {
      const body = await adminApi.songAnalysisStageOutput(token, String(workId), stage.stage)
      setOutput(JSON.stringify(body, null, 2))
      setOutputState("open")
    } catch {
      setOutputState("error")
    }
  }, [outputState, token, workId, stage.stage])

  return (
    <>
      <tr>
        <Td className="font-medium">{stage.stage}</Td>
        <Td>
          <Badge tone={statusTone(stage.status)}>{stage.status}</Badge>
        </Td>
        <Td>{stage.attempt}</Td>
        <Td>{formatDurationBetween(stage.startedAt, stage.finishedAt)}</Td>
        <Td className="max-w-[28rem] break-words text-[#991b1b]">
          {stage.errorCode ? (
            <>
              <div className="font-semibold">{stage.errorCode}</div>
              <div className="text-xs text-[#637083]">{stage.errorClass}</div>
              <div className="text-xs">{stage.errorMessage}</div>
            </>
          ) : (
            "-"
          )}
        </Td>
        <Td>
          {stage.outputLength ? (
            <Button variant="secondary" onClick={toggleOutput} disabled={outputState === "loading"}>
              {outputState === "open" ? "Hide" : `View (${stage.outputLength.toLocaleString()} chars)`}
            </Button>
          ) : (
            "-"
          )}
        </Td>
      </tr>
      {outputState === "open" || outputState === "error" ? (
        <tr>
          <Td colSpan={6} className="h-auto bg-[#f6f7f9] py-3">
            {outputState === "error" ? (
              <span className="text-sm text-[#b91c1c]">Could not load output.</span>
            ) : (
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-all text-xs text-[#18212f]">{output}</pre>
            )}
          </Td>
        </tr>
      ) : null}
    </>
  )
})

function terminalAt(work: SongAnalysisWorkDetail) {
  return work.completedAt ?? work.failedAt
}

function formatDurationBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return "-"
  return formatDurationMillis(Math.max(0, new Date(end).getTime() - new Date(start).getTime()))
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "COMPLETED") return "success"
  if (status === "FAILED") return "danger"
  if (status === "RUNNING") return "warning"
  return "neutral"
}
