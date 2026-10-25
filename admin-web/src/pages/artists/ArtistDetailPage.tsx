import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { useParams } from "react-router-dom"
import { ApiError, adminApi } from "@/api/client"
import type { ArtistDetail } from "@/api/types"
import { ErrorState, LoadingState } from "@/components/StateViews"
import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"
import { formatDateTime } from "@/lib/utils"

function errorText(cause: unknown) {
  return cause instanceof ApiError ? `${cause.status}: ${cause.message}` : "Request failed"
}

export function ArtistDetailPage() {
  const { token } = useAuth()
  const { artistId = "" } = useParams()
  const [detail, setDetail] = React.useState<ArtistDetail | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")
  const [channel, setChannel] = React.useState("")
  const [channelTitle, setChannelTitle] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .artist(token!, artistId)
      .then((result) => {
        if (!alive) return
        setDetail(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [artistId, token])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  if (state === "loading") return <LoadingState />
  if (state === "error" || !detail) return <ErrorState label="Could not load artist." />
  const artistKey = detail.artist.id

  const add = () =>
    run(async () => {
      const created = await adminApi.addArtistChannel(token!, artistKey, channel.trim(), channelTitle.trim() || null)
      setDetail((current) => current && { ...current, youtubeChannels: [...current.youtubeChannels, created] })
      setChannel("")
      setChannelTitle("")
    })

  const remove = (channelId: string) =>
    run(async () => {
      await adminApi.removeArtistChannel(token!, artistKey, channelId)
      setDetail((current) => current && { ...current, youtubeChannels: current.youtubeChannels.filter((it) => it.channelId !== channelId) })
    })

  return (
    <>
      <PageHeader
        title={detail.artist.name}
        meta={
          detail.appleMusicUrl ? (
            <a className="text-[#0f766e] hover:underline" href={detail.appleMusicUrl} rel="noreferrer" target="_blank">
              Apple Music
            </a>
          ) : undefined
        }
      />
      <section className="max-w-3xl">
        <h2 className="mb-2 text-sm font-semibold text-[#18212f]">Official YouTube channels</h2>
        {error ? (
          <div className="mb-3 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]" role="alert">
            {error}
          </div>
        ) : null}
        <form
          className="mb-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (channel.trim()) add()
          }}
        >
          <Input
            aria-label="Channel ID or URL"
            placeholder="UC… or youtube.com/channel/UC…"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
          />
          <Input
            aria-label="Channel name"
            className="max-w-56"
            placeholder="Channel name"
            value={channelTitle}
            onChange={(event) => setChannelTitle(event.target.value)}
          />
          <Button type="submit" aria-label="Add channel" title="Add channel" size="icon" disabled={busy || !channel.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        {detail.youtubeChannels.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Channel</Th>
                <Th>ID</Th>
                <Th>Added</Th>
                <Th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {detail.youtubeChannels.map((it) => (
                <tr key={it.channelId}>
                  <Td>
                    <a
                      className="font-medium text-[#0f766e] hover:underline"
                      href={`https://www.youtube.com/channel/${it.channelId}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {it.channelTitle ?? it.channelId}
                    </a>
                  </Td>
                  <Td className="font-mono text-xs text-[#637083]">{it.channelId}</Td>
                  <Td>{formatDateTime(it.createdAt)}</Td>
                  <Td>
                    <Button
                      aria-label={`Remove ${it.channelTitle ?? it.channelId}`}
                      disabled={busy}
                      onClick={() => remove(it.channelId)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </section>
    </>
  )
}
