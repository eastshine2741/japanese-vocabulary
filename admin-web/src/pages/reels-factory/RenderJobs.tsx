import * as React from "react"
import { Download } from "lucide-react"
import { adminApi } from "@/api/client"
import type { ReelsRenderJob } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const POLL_MS = 3000

/**
 * 서버 렌더 작업 목록. 진행 중인 작업이 있을 때만 다시 읽는다.
 * 이 탭에서 맡긴 작업은 끝나면 바로 받고, 그 밖의 작업(닫았던 탭 등)은 목록에서 받는다.
 */
export function useRenderJobs(token: string | null, onError: (message: string) => void) {
  const [jobs, setJobs] = React.useState<ReelsRenderJob[]>([])
  const autoDownload = React.useRef(new Set<string>())
  const onErrorRef = React.useRef(onError)
  onErrorRef.current = onError

  const download = React.useCallback(
    async (job: ReelsRenderJob) => {
      if (!token) return
      try {
        downloadBlob(await adminApi.reelsRenderOutput(token, job.id), `${job.artist}-${job.title}-kotonoha-reel.mp4`)
      } catch (cause) {
        onErrorRef.current(cause instanceof Error ? cause.message : "Download failed")
      }
    },
    [token],
  )

  const refresh = React.useCallback(async () => {
    if (!token) return
    const next = await adminApi.reelsRenderJobs(token)
    // 맡기기 전에 나간 요청의 응답이 늦게 오면 방금 맡긴 작업이 빠져 있다. 지우면 다시 읽기도 멈춘다.
    setJobs((current) => [
      ...current.filter((job) => autoDownload.current.has(job.id) && !next.some((it) => it.id === job.id)),
      ...next,
    ])
    for (const job of next) {
      if (!autoDownload.current.has(job.id) || !isFinished(job)) continue
      autoDownload.current.delete(job.id)
      if (job.status === "SUCCEEDED") void download(job)
      else onErrorRef.current(`${job.title}: ${job.error ?? "render_failed"}`)
    }
  }, [download, token])

  const add = React.useCallback((job: ReelsRenderJob) => {
    autoDownload.current.add(job.id)
    setJobs((current) => [job, ...current.filter((it) => it.id !== job.id)])
  }, [])

  React.useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const active = jobs.some((job) => !isFinished(job))
  React.useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => refresh().catch(() => {}), POLL_MS)
    return () => window.clearInterval(timer)
  }, [active, refresh])

  return { jobs, add, download }
}

export const RenderJobList = React.memo(function RenderJobList({
  jobs,
  onDownload,
}: {
  jobs: ReelsRenderJob[]
  onDownload: (job: ReelsRenderJob) => void
}) {
  if (jobs.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Render jobs">
      {jobs.map((job) => (
        <RenderJobItem job={job} key={job.id} onDownload={onDownload} />
      ))}
    </ul>
  )
})

const RenderJobItem = React.memo(function RenderJobItem({
  job,
  onDownload,
}: {
  job: ReelsRenderJob
  onDownload: (job: ReelsRenderJob) => void
}) {
  const handleDownload = React.useCallback(() => onDownload(job), [job, onDownload])
  return (
    <li className="flex items-center gap-2 rounded-md border border-[#e2e8f0] bg-white px-2 py-1 text-xs text-[#42526b]">
      <span className="max-w-[240px] truncate">
        {job.artist} - {job.title}
      </span>
      <span className="text-[#94a3b8]">{formatTime(job.createdAt)}</span>
      <Badge tone={STATUS_TONE[job.status]}>{job.status === "FAILED" ? (job.error ?? job.status) : job.status}</Badge>
      {job.status === "SUCCEEDED" ? (
        <Button aria-label={`Download ${job.title}`} className="h-6 px-2" onClick={handleDownload} type="button" variant="secondary">
          <Download className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </li>
  )
})

const STATUS_TONE = {
  QUEUED: "neutral",
  RUNNING: "warning",
  SUCCEEDED: "success",
  FAILED: "danger",
} as const

function isFinished(job: ReelsRenderJob) {
  return job.status === "SUCCEEDED" || job.status === "FAILED"
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
