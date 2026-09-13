import * as React from "react"
import { ChevronDown, Search } from "lucide-react"
import { adminApi, ApiError } from "@/api/client"
import type { ReelsSongCandidate } from "@/api/types"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth"
import { cn } from "@/lib/utils"

/** 툴바의 곡 선택. 닫혀 있으면 고른 곡 제목만, 열면 검색과 후보 목록. 처음엔 첫 곡을 고른다. */
export function SongPicker({
  selectedSongId,
  onSelect,
  onError,
}: {
  selectedSongId: number | null
  onSelect(songId: number): void
  onError(message: string): void
}) {
  const { token } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [songs, setSongs] = React.useState<ReelsSongCandidate[]>([])
  const [loading, setLoading] = React.useState(true)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const autoSelected = React.useRef(false)

  React.useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    adminApi
      .reelsSongs(token, 0, query)
      .then((page) => {
        if (cancelled) return
        setSongs(page.content)
        if (!autoSelected.current && page.content[0]) {
          autoSelected.current = true
          onSelect(page.content[0].id)
        }
      })
      .catch((cause) => {
        if (!cancelled) onError(cause instanceof ApiError ? `${cause.status}: ${cause.message}` : "Request failed")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [onError, onSelect, query, token])

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener("pointerdown", onPointerDown)
    return () => window.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  const selected = songs.find((song) => song.id === selectedSongId)

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="focus-ring flex h-9 min-w-[260px] items-center gap-2 rounded-md border border-[#cbd5e1] bg-white px-3 text-left text-sm hover:bg-[#f8fafc]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {selected ? (
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold text-[#18212f]">{selected.title}</span>
            <span className="text-[#637083]"> / {selected.artist}</span>
          </span>
        ) : (
          <span className="flex-1 text-[#637083]">{loading ? "Loading songs..." : "Select a song"}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-[#637083]" />
      </button>
      {open ? (
        <div className="absolute left-0 top-10 z-30 w-[360px] rounded-lg border border-[#d9e1ea] bg-white shadow-lg">
          <div className="border-b border-[#e2e8f0] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#7b8798]" />
              <Input
                aria-label="Song search"
                autoFocus
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="title or artist"
                value={query}
              />
            </div>
          </div>
          <div className="max-h-[360px] overflow-auto p-1" role="listbox">
            {songs.map((song) => (
              <button
                aria-selected={song.id === selectedSongId}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  song.id === selectedSongId ? "bg-[#e6fffb]" : "hover:bg-[#f8fafc]",
                )}
                key={song.id}
                onClick={() => {
                  onSelect(song.id)
                  setOpen(false)
                }}
                role="option"
                type="button"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-[#18212f]">{song.title}</span>
                  <span className="text-[#637083]"> / {song.artist}</span>
                </span>
                {song.renderEligible ? (
                  <Badge tone="success">eligible</Badge>
                ) : (
                  <Badge tone="warning">{song.ineligibleReason ?? "ineligible"}</Badge>
                )}
              </button>
            ))}
            {!loading && songs.length === 0 ? <div className="p-3 text-xs text-[#637083]">No songs</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
