import * as React from "react"
import { Filter } from "lucide-react"
import { Link } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { LyricSummary, PageResponse } from "@/api/types"
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { PaginationBar } from "@/components/PaginationBar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"
import { formatDateTime, formatNumber } from "@/lib/utils"

const statuses = ["", "PENDING", "COMPLETED", "FAILED"]

export function LyricsPage() {
  const { token } = useAuth()
  const [page, setPage] = React.useState(0)
  const [status, setStatus] = React.useState("")
  const [submittedStatus, setSubmittedStatus] = React.useState("")
  const [data, setData] = React.useState<PageResponse<LyricSummary> | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .lyrics(token!, page, submittedStatus)
      .then((result) => {
        if (!alive) return
        setData(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [page, submittedStatus, token])

  return (
    <>
      <PageHeader title="Lyrics" meta={data ? `${formatNumber(data.totalElements)} rows` : undefined} />
      <form
        className="mb-4 flex max-w-sm gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(0)
          setSubmittedStatus(status)
        }}
      >
        <select
          className="focus-ring h-9 flex-1 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Lyric status"
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item || "All statuses"}
            </option>
          ))}
        </select>
        <Button type="submit" aria-label="Filter lyrics" title="Filter lyrics" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </form>
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
                <Th>Status</Th>
                <Th>Retries</Th>
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
                  <Td>
                    <Badge tone={lyric.status === "COMPLETED" ? "success" : lyric.status === "FAILED" ? "danger" : "warning"}>
                      {lyric.status}
                    </Badge>
                  </Td>
                  <Td>{lyric.retryCount}</Td>
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
