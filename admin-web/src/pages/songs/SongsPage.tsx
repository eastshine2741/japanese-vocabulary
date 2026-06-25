import * as React from "react"
import { Search } from "lucide-react"
import { Link } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { PageResponse, SongSummary } from "@/api/types"
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { PaginationBar } from "@/components/PaginationBar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"
import { formatDateTime, formatNumber } from "@/lib/utils"

export function SongsPage() {
  const { token } = useAuth()
  const [page, setPage] = React.useState(0)
  const [query, setQuery] = React.useState("")
  const [submittedQuery, setSubmittedQuery] = React.useState("")
  const [data, setData] = React.useState<PageResponse<SongSummary> | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .songs(token!, page, submittedQuery)
      .then((result) => {
        if (!alive) return
        setData(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [page, submittedQuery, token])

  return (
    <>
      <PageHeader title="Songs" meta={data ? `${formatNumber(data.totalElements)} rows` : undefined} />
      <form
        className="mb-4 flex max-w-xl gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(0)
          setSubmittedQuery(query)
        }}
      >
        <Input placeholder="Title or artist" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button type="submit" aria-label="Search songs" title="Search songs" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </form>
      {state === "loading" ? <LoadingState /> : null}
      {state === "error" ? <ErrorState label="Could not load songs." /> : null}
      {state === "ready" && data?.content.length === 0 ? <EmptyState label="No songs found." /> : null}
      {state === "ready" && data && data.content.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Title</Th>
                <Th>Artist</Th>
                <Th>Duration</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((song) => (
                <tr key={song.id} className="hover:bg-[#f9fbfc]">
                  <Td className="w-24 font-mono text-xs text-[#637083]">{song.id}</Td>
                  <Td>
                    <Link className="font-medium text-[#0f766e] hover:underline" to={`/songs/${song.id}`}>
                      {song.title}
                    </Link>
                  </Td>
                  <Td>{song.artist}</Td>
                  <Td>{song.durationSeconds ? `${song.durationSeconds}s` : "-"}</Td>
                  <Td>{formatDateTime(song.createdAt)}</Td>
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
