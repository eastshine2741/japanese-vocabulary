import * as React from "react"
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from "lucide-react"
import { ApiError, adminApi } from "@/api/client"
import type { Recommendation, SongSummary } from "@/api/types"
import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth"

function Artwork({ url }: { url: string | null }) {
  return url ? (
    <img alt="" className="h-10 w-10 shrink-0 rounded object-cover" src={url} />
  ) : (
    <div className="h-10 w-10 shrink-0 rounded bg-[#e8edf3]" />
  )
}

function errorText(cause: unknown) {
  return cause instanceof ApiError ? `${cause.status}: ${cause.message}` : "Request failed"
}

export function RecommendationsPage() {
  const { token } = useAuth()
  const [items, setItems] = React.useState<Recommendation[]>([])
  const [query, setQuery] = React.useState("")
  const [songs, setSongs] = React.useState<SongSummary[]>([])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!token) return
    adminApi.recommendations(token).then(setItems).catch((cause) => setError(errorText(cause)))
  }, [token])

  React.useEffect(() => {
    if (!token || !query.trim()) {
      setSongs([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      adminApi
        .songs(token, 0, query)
        .then((result) => {
          if (!cancelled) setSongs(result.content)
        })
        .catch((cause) => {
          if (!cancelled) setError(errorText(cause))
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, token])

  const run = React.useCallback(async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }, [])

  const add = (songId: number) =>
    run(async () => {
      const created = await adminApi.addRecommendation(token!, songId)
      setItems((current) => [...current, created])
    })

  const remove = (id: number) =>
    run(async () => {
      await adminApi.removeRecommendation(token!, id)
      setItems((current) => current.filter((item) => item.id !== id))
    })

  const move = (index: number, delta: number) =>
    run(async () => {
      const next = [...items]
      const [moved] = next.splice(index, 1)
      next.splice(index + delta, 0, moved)
      setItems(await adminApi.reorderRecommendations(token!, next.map((item) => item.id)))
    })

  const addedSongIds = new Set(items.map((item) => item.songId))

  return (
    <div>
      <PageHeader title="Recommendations" meta={`${items.length} songs`} />
      {error ? (
        <div className="mb-4 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]" role="alert">
          {error}
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#7b8798]" />
            <Input
              aria-label="Song search"
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="title or artist"
              value={query}
            />
          </div>
          <ul className="divide-y divide-[#e2e8f0] rounded-lg border border-[#d9e1ea] bg-white">
            {songs.map((song) => {
              const added = addedSongIds.has(song.id)
              return (
                <li className="flex items-center gap-3 p-2" key={song.id}>
                  <Artwork url={song.artworkUrl} />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate font-semibold text-[#18212f]">{song.title}</div>
                    <div className="truncate text-[#637083]">{song.artist}</div>
                  </div>
                  <Button
                    aria-label={`${added ? "Added" : "Add"} ${song.title}`}
                    disabled={added || busy}
                    onClick={() => add(song.id)}
                    size="icon"
                    variant="secondary"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
        <section>
          <ol className="divide-y divide-[#e2e8f0] rounded-lg border border-[#d9e1ea] bg-white">
            {items.map((item, index) => (
              <li className="flex items-center gap-3 p-2" key={item.id}>
                <span className="w-6 text-right text-sm text-[#637083]">{index + 1}</span>
                <Artwork url={item.artworkUrl} />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="truncate font-semibold text-[#18212f]">{item.title}</div>
                  <div className="truncate text-[#637083]">{item.artist}</div>
                </div>
                <Button
                  aria-label={`Move up ${item.title}`}
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                  size="icon"
                  variant="ghost"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Move down ${item.title}`}
                  disabled={busy || index === items.length - 1}
                  onClick={() => move(index, 1)}
                  size="icon"
                  variant="ghost"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Remove ${item.title}`}
                  disabled={busy}
                  onClick={() => remove(item.id)}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
