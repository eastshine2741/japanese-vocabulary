import * as React from "react"
import { PlayCircle, RefreshCw } from "lucide-react"
import { adminApi } from "@/api/client"
import type { RecommendationOperationResult } from "@/api/types"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"
import { formatNumber } from "@/lib/utils"

type OperationKey = "dispatch" | "reconcile"

export function RecommendationsPage() {
  const { token } = useAuth()
  const [limit, setLimit] = React.useState(10)
  const [running, setRunning] = React.useState<OperationKey | null>(null)
  const [result, setResult] = React.useState<RecommendationOperationResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const runOperation = React.useCallback(
    async (operation: OperationKey) => {
      setRunning(operation)
      setError(null)
      try {
        const nextResult =
          operation === "dispatch"
            ? await adminApi.dispatchRecommendationAnalysis(token!, limit)
            : await adminApi.reconcileRecommendationCompleted(token!, limit)
        setResult(nextResult)
      } catch {
        setError("Operation failed. Check admin-api logs for details.")
      } finally {
        setRunning(null)
      }
    },
    [limit, token],
  )

  return (
    <>
      <PageHeader
        title="Recommendations"
        meta="Manual candidate analysis and recommendation reconciliation"
      />

      <section className="mb-4 rounded-lg border border-[#d9e1ea] bg-white p-4">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#18212f]">Manual workflow triggers</h2>
            <p className="mt-1 text-sm text-[#637083]">
              Run these after approving candidates. They process at most the configured limit per click.
            </p>
          </div>
          <label className="text-xs font-medium uppercase tracking-normal text-[#637083]">
            Limit
            <input
              className="focus-ring mt-1 block h-9 w-24 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm font-normal text-[#18212f]"
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value) || 1)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => runOperation("dispatch")}
            disabled={running !== null}
          >
            <PlayCircle className="h-4 w-4" />
            {running === "dispatch" ? "Dispatching..." : "Dispatch analysis"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => runOperation("reconcile")}
            disabled={running !== null}
          >
            <RefreshCw className="h-4 w-4" />
            {running === "reconcile" ? "Reconciling..." : "Reconcile completed"}
          </Button>
        </div>
      </section>

      {error ? (
        <div className="mb-4 rounded-md border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#991b1b]">
          {error}
        </div>
      ) : null}

      {result ? (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <SummaryCard label="Processed" value={result.processed} />
            <SummaryCard label="Succeeded" value={result.succeeded} />
            <SummaryCard label="Skipped" value={result.skipped} />
            <SummaryCard label="Failed" value={result.failed} />
          </div>
          {result.items.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>Candidate</Th>
                  <Th>Status</Th>
                  <Th>Work</Th>
                  <Th>Recommendation</Th>
                  <Th>Message</Th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={`${item.candidateId}-${item.workId ?? "none"}-${item.status}`} className="hover:bg-[#f9fbfc]">
                    <Td className="font-mono text-xs text-[#637083]">{item.candidateId}</Td>
                    <Td>
                      <Badge tone={operationTone(item.status)}>{item.status}</Badge>
                    </Td>
                    <Td>{item.workId ?? "-"}</Td>
                    <Td>{item.recommendationId ?? "-"}</Td>
                    <Td className="text-[#637083]">{item.message ?? "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="border-y border-[#d9e1ea] bg-white px-4 py-10 text-center text-sm text-[#637083]">
              No eligible candidates found for this operation.
            </div>
          )}
        </>
      ) : (
        <div className="border-y border-[#d9e1ea] bg-white px-4 py-10 text-center text-sm text-[#637083]">
          No operation has been run yet.
        </div>
      )}
    </>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#d9e1ea] bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-normal text-[#637083]">{label}</div>
      <div className="mt-1 text-xl font-semibold text-[#18212f]">{formatNumber(value)}</div>
    </div>
  )
}

function operationTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "SUCCEEDED") return "success"
  if (status === "FAILED") return "danger"
  if (status === "SKIPPED") return "warning"
  return "neutral"
}
