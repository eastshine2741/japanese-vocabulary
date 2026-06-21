import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { LyricDetail } from "@/api/types"
import { DetailGrid, DetailItem } from "@/components/DetailGrid"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"
import { useAuth } from "@/features/auth"
import { formatDateTime } from "@/lib/utils"

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
      <PageHeader title={`Lyric #${lyric.id}`} meta={<Badge tone={lyric.status === "COMPLETED" ? "success" : "warning"}>{lyric.status}</Badge>} />
      <DetailGrid>
        <DetailItem label="Song" value={<Link className="text-[#0f766e] hover:underline" to={`/songs/${lyric.songId}`}>{lyric.songId}</Link>} />
        <DetailItem label="Type" value={lyric.lyricType} />
        <DetailItem label="Retries" value={lyric.retryCount} />
        <DetailItem label="LRCLIB" value={lyric.lrclibId ?? "-"} />
        <DetailItem label="VocaDB" value={lyric.vocadbId ?? "-"} />
        <DetailItem label="Updated" value={formatDateTime(lyric.updatedAt)} />
      </DetailGrid>
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-[#18212f]">Raw content</h2>
        <pre className="max-h-[360px] overflow-auto border-y border-[#d9e1ea] bg-white p-4 text-xs text-[#18212f]">
          {JSON.stringify(lyric.rawContent, null, 2)}
        </pre>
      </section>
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-[#18212f]">Analyzed content</h2>
        <pre className="max-h-[360px] overflow-auto border-y border-[#d9e1ea] bg-white p-4 text-xs text-[#18212f]">
          {JSON.stringify(lyric.analyzedContent, null, 2)}
        </pre>
      </section>
    </>
  )
}
