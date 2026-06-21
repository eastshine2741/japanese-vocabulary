import * as React from "react"
import { Search } from "lucide-react"
import { Link } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { AdminUser, PageResponse } from "@/api/types"
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { PaginationBar } from "@/components/PaginationBar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"
import { formatDateTime, formatNumber } from "@/lib/utils"

export function UsersPage() {
  const { token } = useAuth()
  const [page, setPage] = React.useState(0)
  const [query, setQuery] = React.useState("")
  const [submittedQuery, setSubmittedQuery] = React.useState("")
  const [data, setData] = React.useState<PageResponse<AdminUser> | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .users(token!, page, submittedQuery)
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
      <PageHeader title="Users" meta={data ? `${formatNumber(data.totalElements)} rows` : undefined} />
      <form
        className="mb-4 flex max-w-xl gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(0)
          setSubmittedQuery(query)
        }}
      >
        <Input placeholder="Username, email, or name" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button type="submit" aria-label="Search users" title="Search users" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </form>
      {state === "loading" ? <LoadingState /> : null}
      {state === "error" ? <ErrorState label="Could not load users." /> : null}
      {state === "ready" && data?.content.length === 0 ? <EmptyState label="No users found." /> : null}
      {state === "ready" && data && data.content.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Username</Th>
                <Th>Provider</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((user) => (
                <tr key={user.id} className="hover:bg-[#f9fbfc]">
                  <Td className="w-24 font-mono text-xs text-[#637083]">{user.id}</Td>
                  <Td>
                    <Link className="font-medium text-[#0f766e] hover:underline" to={`/users/${user.id}`}>
                      {user.username}
                    </Link>
                  </Td>
                  <Td>{user.provider}</Td>
                  <Td>{user.email ?? "-"}</Td>
                  <Td>
                    <Badge tone={user.deletedAt ? "danger" : "success"}>{user.deletedAt ? "DELETED" : "ACTIVE"}</Badge>
                  </Td>
                  <Td>{formatDateTime(user.createdAt)}</Td>
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
