import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { SongReportDetail, SongReportReviewChange } from "@/api/types"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth"
import { cn, formatDateTime } from "@/lib/utils"
import { ReviewForm } from "@/pages/song-reports/ReviewForm"
import { statusTone } from "@/pages/song-reports/SongReportsPage"
import { changeFieldLabels, formatChangeValue, reportedField } from "@/pages/song-reports/reportValues"

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

  const { context } = report
  const lyricMismatch = context.reportLyricId !== context.activeLyricId
  const field = reportedField(report)

  return (
    <>
      <PageHeader
        title={`Report #${report.id}`}
        meta={<Badge tone={statusTone(report.status)}>{report.status}</Badge>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#637083]">
        <Link className="font-medium text-[#0f766e] hover:underline" to={`/songs/${context.song.id}`}>
          {context.song.title} · {context.song.artist}
        </Link>
        <span>
          by{" "}
          <Link className="text-[#0f766e] hover:underline" to={`/users/${report.userId}`}>
            {report.username}
          </Link>
        </span>
        <span>{formatDateTime(report.createdAt)}</span>
        {context.activeLyricId != null ? (
          <Link className="text-[#0f766e] hover:underline" to={`/lyrics/${context.activeLyricId}`}>
            Lyric #{context.activeLyricId}
          </Link>
        ) : null}
      </div>

      {lyricMismatch ? (
        <div role="alert" className="mb-4 rounded-md border border-[#fde68a] bg-[#fef3c7] px-3 py-2 text-sm text-[#854d0e]">
          Lyric changed since report: reported #{context.reportLyricId ?? "-"}, active #{context.activeLyricId ?? "-"}
        </div>
      ) : null}

      <div className="space-y-4">
        <Step index={1} title="Reported problem">
          <div className="text-lg font-semibold text-[#18212f]">{report.typeLabel}</div>
          <ReportedTarget report={report} />
        </Step>

        <Step index={2} title="User suggestion">
          <div className="grid gap-3 md:grid-cols-2">
            <FieldValue label={`Current ${field.label}`} value={field.value} />
            <FieldValue label="Suggested" value={report.suggestion} empty="No suggestion" highlight={!!report.suggestion} />
          </div>
        </Step>

        {report.status === "PENDING" ? (
          <Step index={3} title="Fix to apply">
            <ReviewForm report={report} token={token!} onReviewed={setReport} />
          </Step>
        ) : (
          <Step
            index={3}
            title={report.status === "APPROVED" ? "Applied fix" : "Rejected"}
            meta={formatDateTime(report.reviewedAt)}
          >
            {report.reviewNote ? <FieldValue label="Note" value={report.reviewNote} /> : null}
            {report.status === "APPROVED" ? (
              (report.reviewChanges ?? []).length > 0 ? (
                <div className="divide-y divide-[#edf1f5] rounded-md border border-[#d9e1ea]">
                  {(report.reviewChanges ?? []).map((change, index) => (
                    <ChangeRow key={index} change={change} />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#637083]">No changes</div>
              )
            ) : null}
          </Step>
        )}
      </div>
    </>
  )
}

function Step({
  index,
  title,
  meta,
  children,
}: {
  index: number
  title: string
  meta?: React.ReactNode
  children: React.ReactNode
}) {
  const headingId = `report-step-${index}`
  return (
    <section className="rounded-md border border-[#d9e1ea] bg-white" aria-labelledby={headingId}>
      <div className="flex items-center gap-3 border-b border-[#edf1f5] px-4 py-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#18212f] text-xs font-semibold text-white">
          {index}
        </span>
        <h2 id={headingId} className="text-sm font-semibold text-[#18212f]">
          {title}
        </h2>
        {meta ? <span className="ml-auto text-xs text-[#637083]">{meta}</span> : null}
      </div>
      <div className="space-y-3 px-4 py-4">{children}</div>
    </section>
  )
}

function FieldValue({
  label,
  value,
  empty = "-",
  highlight,
}: {
  label: string
  value: string | null
  empty?: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border px-3 py-2",
        highlight ? "border-[#fcd34d] bg-[#fffbeb]" : "border-[#edf1f5] bg-[#f8fafc]",
      )}
    >
      <div className="text-xs font-semibold uppercase text-[#637083]">{label}</div>
      <div className={cn("mt-1 break-words text-sm", highlight ? "font-semibold text-[#18212f]" : "text-[#18212f]")}>
        {value ?? <span className="text-[#94a3b8]">{empty}</span>}
      </div>
    </div>
  )
}

/** 제보한 줄 원문에 짚은 단어를 칠해 보여준다. MV 제보는 줄이 없다. */
function ReportedTarget({ report }: { report: SongReportDetail }) {
  const { context, target } = report
  const line = context.line
  if (!line) {
    return context.song.youtubeUrl ? (
      <a className="break-all text-sm text-[#0f766e] hover:underline" href={context.song.youtubeUrl} target="_blank" rel="noreferrer">
        {context.song.youtubeUrl}
      </a>
    ) : null
  }

  const start = target?.charStart
  const end = target?.charEnd
  const marked = start != null && end != null && end > start
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase text-[#637083]">Line {line.index}</div>
      <div className="text-base text-[#18212f]">
        {marked ? (
          <>
            {line.text.slice(0, start)}
            <mark className="rounded bg-[#fde68a] px-0.5 font-semibold text-[#18212f]">{line.text.slice(start, end)}</mark>
            {line.text.slice(end)}
          </>
        ) : (
          line.text
        )}
      </div>
      {line.koreanLyrics ? <div className="text-sm text-[#637083]">{line.koreanLyrics}</div> : null}
    </div>
  )
}

function ChangeRow({ change }: { change: SongReportReviewChange }) {
  const { lineIndex, charStart, charEnd } = change.locator as { lineIndex?: number; charStart?: number; charEnd?: number }
  const where = [lineIndex != null ? `line ${lineIndex}` : null, charStart != null ? `${charStart}-${charEnd}` : null]
    .filter(Boolean)
    .join(" · ")
  return (
    <div className="px-3 py-2 text-sm">
      <div className="text-xs font-semibold text-[#42526b]">
        {changeFieldLabels[change.field] ?? change.field}
        {where ? <span className="ml-2 font-normal text-[#637083]">{where}</span> : null}
      </div>
      <div className="mt-1 grid grid-cols-[48px_1fr] gap-x-2 gap-y-0.5 break-all">
        <span className="text-xs text-[#637083]">Before</span>
        <span className="text-[#991b1b]">{formatChangeValue(change.before) ?? "-"}</span>
        <span className="text-xs text-[#637083]">After</span>
        <span className="text-[#115e59]">{formatChangeValue(change.after) ?? "-"}</span>
      </div>
    </div>
  )
}
