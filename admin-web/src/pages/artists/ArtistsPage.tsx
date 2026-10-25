import * as React from "react"
import { Search } from "lucide-react"
import { Link } from "react-router-dom"
import { adminApi } from "@/api/client"
import type { ArtistSummary } from "@/api/types"
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LinkRow, Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"

export function ArtistsPage() {
  const { token } = useAuth()
  const [query, setQuery] = React.useState("")
  const [submittedQuery, setSubmittedQuery] = React.useState("")
  const [artists, setArtists] = React.useState<ArtistSummary[]>([])
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .artists(token!, submittedQuery)
      .then((result) => {
        if (!alive) return
        setArtists(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [submittedQuery, token])

  return (
    <>
      <PageHeader title="Artists" />
      <form
        className="mb-4 flex max-w-xl gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setSubmittedQuery(query)
        }}
      >
        <Input placeholder="Artist name" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button type="submit" aria-label="Search artists" title="Search artists" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </form>
      {state === "loading" ? <LoadingState /> : null}
      {state === "error" ? <ErrorState label="Could not load artists." /> : null}
      {state === "ready" && artists.length === 0 ? <EmptyState label="No artists found." /> : null}
      {state === "ready" && artists.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Name</Th>
            </tr>
          </thead>
          <tbody>
            {artists.map((artist) => (
              <LinkRow key={artist.id} to={`/artists/${artist.id}`}>
                <Td className="w-24 font-mono text-xs text-[#637083]">{artist.id}</Td>
                <Td>
                  <Link className="font-medium text-[#0f766e] hover:underline" to={`/artists/${artist.id}`}>
                    {artist.name}
                  </Link>
                </Td>
              </LinkRow>
            ))}
          </tbody>
        </Table>
      ) : null}
    </>
  )
}
