import * as React from "react"
import { Filter } from "lucide-react"
import { Link } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { PageResponse, SongAnalysisWorkSummary } from "@/api/types"
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { PaginationBar } from "@/components/PaginationBar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"
import { formatDateTime, formatNumber } from "@/lib/utils"

const statuses = ["", "PENDING", "RUNNING", "COMPLETED", "FAILED"]

export function SongAnalysisWorksPage() {
  const { token } = useAuth()
  const [page, setPage] = React.useState(0)
  const [status, setStatus] = React.useState("")
  const [submittedStatus, setSubmittedStatus] = React.useState("")
  const [data, setData] = React.useState<PageResponse<SongAnalysisWorkSummary> | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .songAnalysisWorks(token!, page, submittedStatus)
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
      <PageHeader title="Song Analysis Work" meta={data ? `${formatNumber(data.totalElements)} rows` : undefined} />
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
          aria-label="Work status"
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item || "All statuses"}
            </option>
          ))}
        </select>
        <Button type="submit" aria-label="Filter work" title="Filter work" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </form>
      {state === "loading" ? <LoadingState /> : null}
      {state === "error" ? <ErrorState label="Could not load song analysis work." /> : null}
      {state === "ready" && data?.content.length === 0 ? <EmptyState label="No song analysis work found." /> : null}
      {state === "ready" && data && data.content.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Song request</Th>
                <Th>Status</Th>
                <Th>Stage</Th>
                <Th>Song</Th>
                <Th>Lyric</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((work) => (
                <tr key={work.id} className="hover:bg-[#f9fbfc]">
                  <Td className="w-24 font-mono text-xs text-[#637083]">
                    <Link className="text-[#0f766e] hover:underline" to={`/song-analysis-works/${work.id}`}>
                      {work.id}
                    </Link>
                  </Td>
                  <Td>
                    <Link className="font-medium text-[#0f766e] hover:underline" to={`/song-analysis-works/${work.id}`}>
                      {work.rawTitle}
                    </Link>
                    <div className="mt-0.5 text-xs text-[#637083]">{work.rawArtist}</div>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(work.status)}>{work.status}</Badge>
                  </Td>
                  <Td>{work.currentStage ?? "-"}</Td>
                  <Td>{work.songId ? <Link className="text-[#0f766e] hover:underline" to={`/songs/${work.songId}`}>{work.songId}</Link> : "-"}</Td>
                  <Td>{work.lyricId ? <Link className="text-[#0f766e] hover:underline" to={`/lyrics/${work.lyricId}`}>{work.lyricId}</Link> : "-"}</Td>
                  <Td>{formatDateTime(work.updatedAt)}</Td>
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

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "COMPLETED") return "success"
  if (status === "FAILED") return "danger"
  if (status === "RUNNING") return "warning"
  return "neutral"
}
