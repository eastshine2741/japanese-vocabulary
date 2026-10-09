import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { SongReportDetail, SongReportReviewChange } from "@/api/types"
import { DetailGrid, DetailItem } from "@/components/DetailGrid"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth"
import { formatDateTime } from "@/lib/utils"
import { ReviewForm } from "@/pages/song-reports/ReviewForm"
import { statusTone } from "@/pages/song-reports/SongReportsPage"

export function SongReportDetailPage() {
  const { token } = useAuth()
  const { reportId = "" } = useParams()
  const [report, setReport] = React.useState<SongReportDetail | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .songReport(token!, reportId)
      .then((result) => {
        if (!alive) return
        setReport(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [reportId, token])

  if (state === "loading") return <LoadingState />
  if (state === "error" || !report) return <ErrorState label="Could not load song report." />

  const { context, target } = report
  const line = context.line
  const lyricMismatch = context.reportLyricId !== context.activeLyricId

  return (
    <>
      <PageHeader
        title={`Report #${report.id}`}
        meta={<Badge tone={statusTone(report.status)}>{report.status}</Badge>}
      />
      <DetailGrid>
        <DetailItem label="Type" value={report.typeLabel} />
        <DetailItem
          label="User"
          value={
            <Link className="text-[#0f766e] hover:underline" to={`/users/${report.userId}`}>
              {report.username}
            </Link>
          }
        />
        <DetailItem label="Created" value={formatDateTime(report.createdAt)} />
        <DetailItem
          label="Target"
          value={
            target
              ? [
                  target.lineIndex != null ? `line ${target.lineIndex}` : null,
                  target.surface ? `${target.surface} (${target.charStart}-${target.charEnd})` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null
          }
        />
        <DetailItem
          label="Suggestion"
          value={
            report.suggestion ? (
              <span className="rounded bg-[#fef3c7] px-1.5 py-0.5 font-medium">{report.suggestion}</span>
            ) : null
          }
        />
        <DetailItem
          label="Song"
          value={
            <Link className="text-[#0f766e] hover:underline" to={`/songs/${context.song.id}`}>
              {context.song.title} · {context.song.artist}
            </Link>
          }
        />
        <DetailItem
          label="YouTube"
          value={
            context.song.youtubeUrl ? (
              <a className="text-[#0f766e] hover:underline" href={context.song.youtubeUrl} target="_blank" rel="noreferrer">
                {context.song.youtubeUrl}
              </a>
            ) : null
          }
        />
        <DetailItem
          label="Lyric"
          value={
            context.activeLyricId != null ? (
              <Link className="text-[#0f766e] hover:underline" to={`/lyrics/${context.activeLyricId}`}>
                #{context.activeLyricId}
              </Link>
            ) : null
          }
        />
      </DetailGrid>

      {lyricMismatch ? (
        <div role="alert" className="mt-3 rounded-md border border-[#fde68a] bg-[#fef3c7] px-3 py-2 text-sm text-[#854d0e]">
          Lyric changed since report: reported #{context.reportLyricId ?? "-"}, active #{context.activeLyricId ?? "-"}
        </div>
      ) : null}

      {line ? (
        <section className="mt-6 border-y border-[#d9e1ea] bg-white" aria-label="Current line">
          <div className="border-b border-[#edf1f5] px-4 py-3 text-xs font-semibold uppercase text-[#637083]">
            Current line {line.index}
          </div>
          <div className="space-y-1 px-4 py-3 text-sm">
            <div className="text-base font-medium text-[#18212f]">{line.text}</div>
            <div className="text-[#42526b]">{line.koreanLyrics ?? "-"}</div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-[#edf1f5] px-4 py-3">
            {line.tokens.map((token) => {
              const reported = token.charStart === target?.charStart && token.charEnd === target?.charEnd
              return (
                <div
                  key={`${token.charStart}-${token.charEnd}`}
                  className={`rounded-md border px-2 py-1 text-xs ${reported ? "border-[#f59e0b] bg-[#fffbeb]" : "border-[#d9e1ea]"}`}
                >
                  <div className="text-sm font-medium text-[#18212f]">{token.surface}</div>
                  <div className="text-[#637083]">
                    {token.charStart}-{token.charEnd} · {token.reading ?? "-"}
                  </div>
                  <div className="text-[#637083]">{token.koreanText ?? "-"}</div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {report.status === "PENDING" ? (
        <ReviewForm report={report} token={token!} onReviewed={setReport} />
      ) : (
        <section className="mt-6 border-y border-[#d9e1ea] bg-white" aria-label="Review result">
          <div className="border-b border-[#edf1f5] px-4 py-3 text-xs font-semibold uppercase text-[#637083]">
            Review · {formatDateTime(report.reviewedAt)}
          </div>
          {report.reviewNote ? <div className="border-b border-[#edf1f5] px-4 py-3 text-sm">{report.reviewNote}</div> : null}
          {(report.reviewChanges ?? []).map((change, index) => (
            <ChangeRow key={index} change={change} />
          ))}
          {(report.reviewChanges ?? []).length === 0 ? <div className="px-4 py-3 text-sm text-[#637083]">No changes</div> : null}
        </section>
      )}
    </>
  )
}

function ChangeRow({ change }: { change: SongReportReviewChange }) {
  return (
    <div className="border-b border-[#edf1f5] px-4 py-3 text-sm last:border-b-0">
      <div className="font-mono text-xs text-[#637083]">
        {change.field} {JSON.stringify(change.locator)}
      </div>
      <div className="mt-1 break-all">
        <span className="text-[#991b1b]">{format(change.before)}</span>
        <span className="mx-2 text-[#637083]">→</span>
        <span className="text-[#115e59]">{format(change.after)}</span>
      </div>
    </div>
  )
}

function format(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value)
}
