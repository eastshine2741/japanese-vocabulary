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

  if (state === "loading") return <LoadingState />
  if (state === "error" || !song) return <ErrorState label="Could not load song." />

  return (
    <>
      <PageHeader title={song.title} meta={song.artist} />
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
    </>
  )
}
