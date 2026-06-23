import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { SongAnalysisWorkDetail } from "@/api/types"
import { DetailGrid, DetailItem } from "@/components/DetailGrid"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"
import { useAuth } from "@/features/auth"
import { formatDateTime, formatDurationMillis } from "@/lib/utils"

export function SongAnalysisWorkDetailPage() {
  const { token } = useAuth()
  const { workId = "" } = useParams()
  const [work, setWork] = React.useState<SongAnalysisWorkDetail | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

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

  if (state === "loading") return <LoadingState />
  if (state === "error" || !work) return <ErrorState label="Could not load song analysis work." />

  return (
    <>
      <PageHeader title={`Work #${work.id}`} meta={<Badge tone={statusTone(work.status)}>{work.status}</Badge>} />
      <DetailGrid>
        <DetailItem label="Title" value={work.rawTitle} />
        <DetailItem label="Artist" value={work.rawArtist} />
        <DetailItem label="Current stage" value={work.currentStage ?? "-"} />
        <DetailItem label="Trigger" value={work.triggerSource} />
        <DetailItem label="Song" value={work.songId ? <Link className="text-[#0f766e] hover:underline" to={`/songs/${work.songId}`}>{work.songId}</Link> : "-"} />
        <DetailItem label="Lyric" value={work.lyricId ? <Link className="text-[#0f766e] hover:underline" to={`/lyrics/${work.lyricId}`}>{work.lyricId}</Link> : "-"} />
        <DetailItem label="Duration" value={work.durationSeconds ? `${work.durationSeconds}s` : "-"} />
        <DetailItem label="Created by user" value={work.createdByUserId ?? "-"} />
        <DetailItem label="Locked by" value={work.lockedBy ?? "-"} />
        <DetailItem label="Locked until" value={formatDateTime(work.lockedUntil)} />
      </DetailGrid>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[#18212f]">Milestones</h2>
        <DetailGrid>
          <DetailItem label="Created" value={formatDateTime(work.createdAt)} />
          <DetailItem label="Player ready" value={formatDateTime(work.playerReadyAt)} />
          <DetailItem label="Completed" value={formatDateTime(work.completedAt)} />
          <DetailItem label="Failed" value={formatDateTime(work.failedAt)} />
          <DetailItem label="Updated" value={formatDateTime(work.updatedAt)} />
          <DetailItem label="Active dedup key" value={work.activeDedupKey ?? "-"} />
        </DetailGrid>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[#18212f]">Elapsed time</h2>
        <DetailGrid>
          <DetailItem label="Created to player ready" value={formatDurationBetween(work.createdAt, work.playerReadyAt)} />
          <DetailItem label="Player ready to terminal" value={formatDurationBetween(work.playerReadyAt, terminalAt(work))} />
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
