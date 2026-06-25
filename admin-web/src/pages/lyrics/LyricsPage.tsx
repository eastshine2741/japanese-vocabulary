import * as React from "react"
import { Link } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { LyricSummary, PageResponse } from "@/api/types"
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { PaginationBar } from "@/components/PaginationBar"
import { Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"
import { formatDateTime, formatNumber } from "@/lib/utils"

export function LyricsPage() {
  const { token } = useAuth()
  const [page, setPage] = React.useState(0)
  const [data, setData] = React.useState<PageResponse<LyricSummary> | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .lyrics(token!, page)
      .then((result) => {
        if (!alive) return
        setData(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [page, token])

  return (
    <>
      <PageHeader title="Lyrics" meta={data ? `${formatNumber(data.totalElements)} rows` : undefined} />
      {state === "loading" ? <LoadingState /> : null}
      {state === "error" ? <ErrorState label="Could not load lyrics." /> : null}
      {state === "ready" && data?.content.length === 0 ? <EmptyState label="No lyrics found." /> : null}
      {state === "ready" && data && data.content.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Song</Th>
                <Th>Type</Th>
                <Th>LRCLIB</Th>
                <Th>VocaDB</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((lyric) => (
                <tr key={lyric.id} className="hover:bg-[#f9fbfc]">
                  <Td className="w-24 font-mono text-xs text-[#637083]">
                    <Link className="text-[#0f766e] hover:underline" to={`/lyrics/${lyric.id}`}>
                      {lyric.id}
                    </Link>
                  </Td>
                  <Td>
                    <Link className="text-[#0f766e] hover:underline" to={`/songs/${lyric.songId}`}>
                      {lyric.songId}
                    </Link>
                  </Td>
                  <Td>{lyric.lyricType}</Td>
                  <Td>{lyric.lrclibId ?? "-"}</Td>
                  <Td>{lyric.vocadbId ?? "-"}</Td>
                  <Td>{formatDateTime(lyric.updatedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <PaginationBar page={data} onPage={setPage} />
        </>
      ) : null}
    </>
  )
}
