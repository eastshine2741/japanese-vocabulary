import * as React from "react"
import { Filter } from "lucide-react"
import { Link } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { LyricMvSyncSummary, PageResponse } from "@/api/types"
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { PaginationBar } from "@/components/PaginationBar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LinkRow, Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"
import { formatDateTime, formatNumber } from "@/lib/utils"
import { syncStatusTone, verdictTone } from "./syncTones"

const statuses = ["", "PENDING", "RUNNING", "COMPLETED", "FAILED"]
const verdicts = ["", "OK", "LOW"]

export function LyricMvSyncsPage() {
  const { token } = useAuth()
  const [page, setPage] = React.useState(0)
  const [status, setStatus] = React.useState("")
  const [verdict, setVerdict] = React.useState("")
  const [filter, setFilter] = React.useState({ status: "", verdict: "" })
  const [data, setData] = React.useState<PageResponse<LyricMvSyncSummary> | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .lyricMvSyncs(token!, page, filter)
      .then((result) => {
        if (!alive) return
        setData(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [page, filter, token])

  return (
    <>
      <PageHeader title="Lyric MV Sync" meta={data ? `${formatNumber(data.totalElements)} rows` : undefined} />
      <form
        className="mb-4 flex max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(0)
          setFilter({ status, verdict })
        }}
      >
        <select
          className="focus-ring h-9 flex-1 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Sync status"
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item || "All statuses"}
            </option>
          ))}
        </select>
        <select
          className="focus-ring h-9 flex-1 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"
          value={verdict}
          onChange={(event) => setVerdict(event.target.value)}
          aria-label="Verdict"
        >
          {verdicts.map((item) => (
            <option key={item} value={item}>
              {item || "All verdicts"}
            </option>
          ))}
        </select>
        <Button type="submit" aria-label="Filter syncs" title="Filter syncs" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </form>
      {state === "loading" ? <LoadingState /> : null}
      {state === "error" ? <ErrorState label="Could not load lyric MV syncs." /> : null}
      {state === "ready" && data?.content.length === 0 ? <EmptyState label="No lyric MV sync found." /> : null}
      {state === "ready" && data && data.content.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Song</Th>
                <Th>Status</Th>
                <Th>Verdict</Th>
                <Th>Method</Th>
                <Th>Lines found</Th>
                <Th>Completed</Th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((sync) => (
                <LinkRow key={sync.id} to={`/lyric-mv-syncs/${sync.id}`}>
                  <Td className="w-20 font-mono text-xs text-[#637083]">
                    <Link className="text-[#0f766e] hover:underline" to={`/lyric-mv-syncs/${sync.id}`}>
                      {sync.id}
                    </Link>
                  </Td>
                  <Td>
                    <Link className="font-medium text-[#0f766e] hover:underline" to={`/lyric-mv-syncs/${sync.id}`}>
                      {sync.title ?? `Lyric ${sync.lyricId}`}
                    </Link>
                    <div className="mt-0.5 text-xs text-[#637083]">
                      {sync.artist ?? "-"}
                      {sync.inUse ? null : <span className="ml-2 text-[#b45309]">not in use</span>}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={syncStatusTone(sync.status)}>{sync.status}</Badge>
                  </Td>
                  <Td>{sync.verdict ? <Badge tone={verdictTone(sync.verdict)}>{sync.verdict}</Badge> : "-"}</Td>
                  <Td>{sync.method ?? "-"}</Td>
                  <Td className="tabular-nums">
                    {sync.lineCount != null ? `${sync.anchoredCount ?? 0} / ${sync.lineCount}` : "-"}
                  </Td>
                  <Td>{formatDateTime(sync.completedAt)}</Td>
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
