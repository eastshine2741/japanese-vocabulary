import * as React from "react"
import { useParams } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { AdminUser } from "@/api/types"
import { DetailGrid, DetailItem } from "@/components/DetailGrid"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/PageHeader"
import { useAuth } from "@/features/auth"
import { formatDateTime } from "@/lib/utils"

export function UserDetailPage() {
  const { token } = useAuth()
  const { userId = "" } = useParams()
  const [user, setUser] = React.useState<AdminUser | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .user(token!, userId)
      .then((result) => {
        if (!alive) return
        setUser(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [token, userId])

  if (state === "loading") return <LoadingState />
  if (state === "error" || !user) return <ErrorState label="Could not load user." />

  return (
    <>
      <PageHeader
        title={user.username}
        meta={<Badge tone={user.deletedAt ? "danger" : "success"}>{user.deletedAt ? "DELETED" : "ACTIVE"}</Badge>}
      />
      <DetailGrid>
        <DetailItem label="ID" value={user.id} />
        <DetailItem label="Provider" value={user.provider} />
        <DetailItem label="Email" value={user.email ?? "-"} />
        <DetailItem label="Name" value={user.name ?? "-"} />
        <DetailItem label="Created" value={formatDateTime(user.createdAt)} />
        <DetailItem label="Deleted" value={formatDateTime(user.deletedAt)} />
      </DetailGrid>
    </>
  )
}
