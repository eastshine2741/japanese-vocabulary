import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { LyricDetail } from "@/api/types"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { LyricDetailContent } from "@/features/lyrics/LyricDetailContent"
import { useAuth } from "@/features/auth"

export function LyricDetailPage() {
  const { token } = useAuth()
  const { lyricId = "" } = useParams()
  const [lyric, setLyric] = React.useState<LyricDetail | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .lyric(token!, lyricId)
      .then((result) => {
        if (!alive) return
        setLyric(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [lyricId, token])

  if (state === "loading") return <LoadingState />
  if (state === "error" || !lyric) return <ErrorState label="Could not load lyric." />

  return (
    <>
      <PageHeader
        title={`Lyric #${lyric.id}`}
        meta={
          <Link className="text-[#0f766e] hover:underline" to={`/songs/${lyric.songId}`}>
            Song #{lyric.songId}
          </Link>
        }
      />
      <LyricDetailContent lyric={lyric} />
    </>
  )
}
