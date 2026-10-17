import * as React from "react"
import { Pencil, Trash2 } from "lucide-react"
import { ApiError, adminApi } from "@/api/client"
import type { FeatureFlag } from "@/api/types"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth"

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** datetime-local 값은 KST 로 읽고 쓴다. 브라우저 시간대와 무관하게 운영 기준 시각을 맞추기 위함. */
export function kstInputToIso(value: string): string | null {
  return value ? new Date(`${value}:00+09:00`).toISOString() : null
}

export function isoToKstInput(iso: string | null): string {
  return iso ? new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 16) : ""
}

function kstText(iso: string | null) {
  return iso ? isoToKstInput(iso).replace("T", " ") : "-"
}

function errorText(cause: unknown) {
  return cause instanceof ApiError ? `${cause.status}: ${cause.message}` : "Request failed"
}

type Draft = { key: string; startAt: string; endAt: string; description: string }

const emptyDraft: Draft = { key: "", startAt: "", endAt: "", description: "" }

export function FeatureFlagsPage() {
  const { token } = useAuth()
  const [flags, setFlags] = React.useState<FeatureFlag[]>([])
  const [draft, setDraft] = React.useState<Draft>(emptyDraft)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    if (token) setFlags(await adminApi.featureFlags(token))
  }, [token])

  React.useEffect(() => {
    reload().catch((cause) => setError(errorText(cause)))
  }, [reload])

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      await reload()
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    run(async () => {
      await adminApi.saveFeatureFlag(token!, draft.key.trim(), {
        startAt: kstInputToIso(draft.startAt),
        endAt: kstInputToIso(draft.endAt),
        description: draft.description,
      })
      setDraft(emptyDraft)
    })
  }

  const remove = (key: string) => {
    if (!window.confirm(`Delete ${key}?`)) return
    run(() => adminApi.deleteFeatureFlag(token!, key))
  }

  const edit = (flag: FeatureFlag) =>
    setDraft({
      key: flag.key,
      startAt: isoToKstInput(flag.startAt),
      endAt: isoToKstInput(flag.endAt),
      description: flag.description,
    })

  const set = (field: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((current) => ({ ...current, [field]: event.target.value }))

  return (
    <div>
      <PageHeader title="Feature Flags" meta={`${flags.length} flags · KST`} />
      {error ? (
        <div className="mb-4 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]" role="alert">
          {error}
        </div>
      ) : null}
      <form
        className="mb-5 grid gap-2 rounded-lg border border-[#d9e1ea] bg-white p-3 md:grid-cols-[1fr_auto_auto_2fr_auto]"
        onSubmit={save}
      >
        <Input aria-label="Key" onChange={set("key")} placeholder="key" required value={draft.key} />
        <Input aria-label="Start (KST)" onChange={set("startAt")} type="datetime-local" value={draft.startAt} />
        <Input aria-label="End (KST)" onChange={set("endAt")} type="datetime-local" value={draft.endAt} />
        <Input aria-label="Description" onChange={set("description")} placeholder="description" value={draft.description} />
        <Button disabled={busy || !draft.key.trim()} type="submit">
          Save
        </Button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-[#d9e1ea] bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-[#e2e8f0] text-left text-[#637083]">
            <tr>
              <th className="px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">Now</th>
              <th className="px-3 py-2 font-medium">Start</th>
              <th className="px-3 py-2 font-medium">End</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {flags.map((flag) => (
              <tr key={flag.key}>
                <td className="px-3 py-2 font-mono text-[#18212f]">{flag.key}</td>
                <td className="px-3 py-2">
                  <Badge tone={flag.on ? "success" : "neutral"}>{flag.on ? "ON" : "OFF"}</Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-[#42526b]">{kstText(flag.startAt)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-[#42526b]">{kstText(flag.endAt)}</td>
                <td className="px-3 py-2 text-[#42526b]">{flag.description}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Button aria-label={`Edit ${flag.key}`} disabled={busy} onClick={() => edit(flag)} size="icon" variant="ghost">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button aria-label={`Delete ${flag.key}`} disabled={busy} onClick={() => remove(flag.key)} size="icon" variant="ghost">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
