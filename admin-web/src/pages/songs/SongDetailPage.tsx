import * as React from "react"
import { ExternalLink, RefreshCcw } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { SongAnalysisWorkSummary, SongDetail } from "@/api/types"
import { DetailGrid, DetailItem } from "@/components/DetailGrid"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { useAuth } from "@/features/auth"
import { formatDateTime } from "@/lib/utils"

function workLabel(work: SongAnalysisWorkSummary) {
  return `#${work.id} ${work.status}`
}

function WorkLink({ work }: { work: SongAnalysisWorkSummary }) {
  return (
    <Link className="inline-flex items-center gap-2 text-[#0f766e] hover:underline" to={`/song-analysis-works/${work.id}`}>
      {workLabel(work)}
    </Link>
  )
}

export function SongDetailPage() {
  const { token } = useAuth()
  const { songId = "" } = useParams()
  const [song, setSong] = React.useState<SongDetail | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")
  const [triggerState, setTriggerState] = React.useState<"idle" | "submitting" | "error">("idle")
  const [triggerMessage, setTriggerMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    let alive = true
    setState("loading")
    setTriggerState("idle")
    setTriggerMessage(null)
    adminApi
      .song(token!, songId)
      .then((result) => {
        if (!alive) return
        setSong(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [songId, token])

  async function triggerReanalysis() {
    if (!token || !song) return
    setTriggerState("submitting")
    setTriggerMessage(null)
    try {
      const work = await adminApi.triggerSongReanalysis(token, String(song.id))
      setSong((current) => {
        if (!current) return current
        const remaining = current.analysisWorks.filter((item) => item.id !== work.id)
        return {
          ...current,
          activeReanalysisWork: ["PENDING", "RUNNING"].includes(work.status) ? work : current.activeReanalysisWork,
          analysisWorks: [work, ...remaining].slice(0, 10),
        }
      })
      setTriggerState("idle")
      setTriggerMessage(`Reanalysis work ${workLabel(work)} is queued.`)
    } catch {
      setTriggerState("error")
      setTriggerMessage("Could not trigger reanalysis. Try again after refreshing the song detail.")
    }
  }

  if (state === "loading") return <LoadingState />
  if (state === "error" || !song) return <ErrorState label="Could not load song." />

  const activeWork = song.activeReanalysisWork
  const triggerDisabled = triggerState === "submitting" || Boolean(activeWork)

  return (
    <>
      <PageHeader title={song.title} meta={song.artist} />
      <section className="mb-5 rounded-lg border border-[#d9e1ea] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#18212f]">Admin reanalysis</h2>
            <p className="mt-1 text-sm text-[#637083]">
              Rerun lyric, MV, and analysis generation. The active lyric/MV switches only after the work completes.
            </p>
            {activeWork ? (
              <p className="mt-2 text-sm text-[#637083]">
                Active blocker: <WorkLink work={activeWork} />
              </p>
            ) : null}
            {triggerMessage ? (
              <p className={triggerState === "error" ? "mt-2 text-sm text-[#b91c1c]" : "mt-2 text-sm text-[#0f766e]"}>{triggerMessage}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#94a3b8]"
            disabled={triggerDisabled}
            onClick={triggerReanalysis}
          >
            <RefreshCcw className="h-4 w-4" />
            {triggerState === "submitting" ? "Triggering..." : activeWork ? "Reanalysis in progress" : "Trigger reanalysis"}
          </button>
        </div>
      </section>
      <DetailGrid>
        <DetailItem label="ID" value={song.id} />
        <DetailItem label="Artist" value={song.artist} />
        <DetailItem label="Duration" value={song.durationSeconds ? `${song.durationSeconds}s` : "-"} />
        <DetailItem label="Created" value={formatDateTime(song.createdAt)} />
        <DetailItem
          label="YouTube"
          value={
            song.youtubeUrl ? (
              <a className="inline-flex items-center gap-1 text-[#0f766e] hover:underline" href={song.youtubeUrl}>
                Open <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              "-"
            )
          }
        />
        <DetailItem
          label="Lyric"
          value={
            song.lyric ? (
              <Link className="inline-flex items-center gap-2 text-[#0f766e] hover:underline" to={`/lyrics/${song.lyric.id}`}>
                #{song.lyric.id}
              </Link>
            ) : (
              "-"
            )
          }
        />
      </DetailGrid>
      <section className="mt-5 rounded-lg border border-[#d9e1ea] bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[#18212f]">Recent analysis works</h2>
        {song.analysisWorks.length === 0 ? (
          <p className="mt-3 text-sm text-[#637083]">No analysis work recorded for this song.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#edf1f5]">
            {song.analysisWorks.map((work) => (
              <li key={work.id} className="grid gap-1 py-3 text-sm text-[#18212f] sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <WorkLink work={work} />
                  <span className="ml-2 text-[#637083]">{work.triggerSource}</span>
                  {work.lyricId ? (
                    <Link className="ml-2 text-[#0f766e] hover:underline" to={`/lyrics/${work.lyricId}`}>
                      lyric #{work.lyricId}
                    </Link>
                  ) : null}
                  {work.youtubeUrl ? (
                    <a className="ml-2 inline-flex items-center gap-1 text-[#0f766e] hover:underline" href={work.youtubeUrl}>
                      MV <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <div className="text-[#637083]">{formatDateTime(work.createdAt)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
