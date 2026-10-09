import * as React from "react"
import { Link } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { PageResponse, SongReportStatus, SongReportSummary } from "@/api/types"
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { PaginationBar } from "@/components/PaginationBar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LinkRow, Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"
import { formatDateTime, formatNumber } from "@/lib/utils"

const statuses: SongReportStatus[] = ["PENDING", "APPROVED", "REJECTED"]

export function SongReportsPage() {
  const { token } = useAuth()
  const [page, setPage] = React.useState(0)
  const [status, setStatus] = React.useState<SongReportStatus>("PENDING")
  const [data, setData] = React.useState<PageResponse<SongReportSummary> | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .songReports(token!, page, status)
      .then((result) => {
        if (!alive) return
        setData(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [page, status, token])

  return (
    <>
      <PageHeader title="Song Reports" meta={data ? `${formatNumber(data.totalElements)} rows` : undefined} />
      <div className="mb-4 flex gap-2" role="group" aria-label="Report status">
        {statuses.map((item) => (
          <Button
            key={item}
            variant={item === status ? "default" : "secondary"}
            aria-pressed={item === status}
            onClick={() => {
              setPage(0)
              setStatus(item)
            }}
          >
            {item}
          </Button>
        ))}
      </div>
      {state === "loading" ? <LoadingState /> : null}
      {state === "error" ? <ErrorState label="Could not load song reports." /> : null}
      {state === "ready" && data?.content.length === 0 ? <EmptyState label="No song reports found." /> : null}
      {state === "ready" && data && data.content.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Created</Th>
                <Th>Song</Th>
                <Th>User</Th>
                <Th>Type</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((report) => (
                <LinkRow key={report.id} to={`/song-reports/${report.id}`}>
                  <Td className="w-20 font-mono text-xs">
                    <Link className="text-[#0f766e] hover:underline" to={`/song-reports/${report.id}`}>
                      {report.id}
                    </Link>
                  </Td>
                  <Td>{formatDateTime(report.createdAt)}</Td>
                  <Td>
                    <Link className="font-medium text-[#0f766e] hover:underline" to={`/songs/${report.songId}`}>
                      {report.songTitle}
                    </Link>
                    <span className="text-[#637083]"> · {report.songArtist}</span>
                  </Td>
                  <Td>
                    <Link className="text-[#0f766e] hover:underline" to={`/users/${report.userId}`}>
                      {report.username}
                    </Link>
                  </Td>
                  <Td>{report.typeLabel}</Td>
                  <Td>
                    <Badge tone={statusTone(report.status)}>{report.status}</Badge>
                  </Td>
                </LinkRow>
              ))}
            </tbody>
          </Table>
          <PaginationBar page={data} onPage={setPage} />
        </>
      ) : null}
    </>
  )
}

export function statusTone(status: SongReportStatus): "neutral" | "success" | "warning" | "danger" {
  if (status === "APPROVED") return "success"
  if (status === "REJECTED") return "danger"
  return "warning"
}
