import * as React from "react"
import { ExternalLink } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { SongDetail } from "@/api/types"
import { DetailGrid, DetailItem } from "@/components/DetailGrid"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { useAuth } from "@/features/auth"
import { formatDateTime } from "@/lib/utils"

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

  const activeWork = song?.activeReanalysisWork ?? null
  const triggerDisabled = triggerState === "submitting" || activeWork != null

  async function handleTriggerReanalysis() {
    if (!song || triggerDisabled) return
    setTriggerState("submitting")
    setTriggerMessage(null)
    try {
      const work = await adminApi.triggerSongReanalysis(token!, songId)
      setSong({
        ...song,
        activeReanalysisWork: {
          id: work.workId,
          rawTitle: song.title,
          rawArtist: song.artist,
          status: work.status,
          currentStage: work.currentStage,
          songId: work.songId,
          lyricId: work.lyricId,
          youtubeUrl: work.youtubeUrl,
          triggerSource: "ADMIN",
          createdByUserId: null,
          createdAt: null,
          updatedAt: null,
          playerReadyAt: null,
          completedAt: null,
          failedAt: null,
        },
        analysisWorks: song.analysisWorks.some((item) => item.id === work.workId)
          ? song.analysisWorks
          : [
              {
                id: work.workId,
                rawTitle: song.title,
                rawArtist: song.artist,
                status: work.status,
                currentStage: work.currentStage,
                songId: work.songId,
                lyricId: work.lyricId,
                youtubeUrl: work.youtubeUrl,
                triggerSource: "ADMIN",
                createdByUserId: null,
                createdAt: null,
                updatedAt: null,
                playerReadyAt: null,
                completedAt: null,
                failedAt: null,
              },
              ...song.analysisWorks,
            ],
      })
      setTriggerMessage(`Reanalysis work #${work.workId} is ${work.status}.`)
      setTriggerState("idle")
    } catch {
      setTriggerMessage("Could not trigger reanalysis. Please try again.")
      setTriggerState("error")
    }
  }

  if (state === "loading") return <LoadingState />
  if (state === "error" || !song) return <ErrorState label="Could not load song." />

  return (
    <>
      <PageHeader title={song.title} meta={song.artist} />
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Admin reanalysis</h2>
            <p className="text-sm text-slate-500">
              Reruns lyric, MV, and analysis generation. Current active song data switches only after completion.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={triggerDisabled}
            onClick={handleTriggerReanalysis}
          >
            {triggerState === "submitting" ? "Triggering..." : activeWork ? "Reanalysis in progress" : "Trigger reanalysis"}
          </button>
        </div>
        {activeWork ? (
          <p className="mt-3 text-sm text-slate-600">
            Active blocker: <Link className="text-[#0f766e] hover:underline" to={`/song-analysis-works/${activeWork.id}`}>work #{activeWork.id}</Link> ({activeWork.status})
          </p>
        ) : null}
        {triggerMessage ? <p className={`mt-3 text-sm ${triggerState === "error" ? "text-red-600" : "text-slate-600"}`}>{triggerMessage}</p> : null}
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
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Recent analysis work</h2>
        {song.analysisWorks.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No analysis work found for this song.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {song.analysisWorks.map((work) => (
              <div key={work.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <Link className="font-medium text-[#0f766e] hover:underline" to={`/song-analysis-works/${work.id}`}>Work #{work.id}</Link>
                <span className="ml-2 text-slate-500">{work.status} · {work.triggerSource}</span>
                {work.lyricId ? <Link className="ml-2 text-[#0f766e] hover:underline" to={`/lyrics/${work.lyricId}`}>lyric #{work.lyricId}</Link> : null}
                {work.youtubeUrl ? <a className="ml-2 text-[#0f766e] hover:underline" href={work.youtubeUrl}>MV</a> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
