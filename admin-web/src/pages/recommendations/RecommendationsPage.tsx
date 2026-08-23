import * as React from "react"
import { ArrowRight, CheckCircle2, RefreshCw, XCircle } from "lucide-react"
import { ApiError, adminApi } from "@/api/client"
import type { Recommendation, RecommendationCandidate, RecommendationOperationResult } from "@/api/types"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, Td, Th } from "@/components/ui/table"
import { useAuth } from "@/features/auth"
import { formatNumber } from "@/lib/utils"

type Stage = "candidates" | "recommendations"

type OperationKey =
  | "prepare"
  | "request-analysis"
  | `candidate-${number}-${string}`
  | `recommendation-${number}-${string}`

// Apple RSS collection buckets candidates into Monday-start weeks, so the operator
// picks a Monday. The default is the week that contains today.
function currentWeekStartDate(): string {
  const today = new Date()
  const daysSinceMonday = (today.getDay() + 6) % 7
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday)
  const month = String(monday.getMonth() + 1).padStart(2, "0")
  const day = String(monday.getDate()).padStart(2, "0")
  return `${monday.getFullYear()}-${month}-${day}`
}

export function RecommendationsPage() {
  const { token } = useAuth()
  const [activeStage, setActiveStage] = React.useState<Stage>("candidates")
  const [selectedWeek, setSelectedWeek] = React.useState<string>(currentWeekStartDate)
  const [collectedWeeks, setCollectedWeeks] = React.useState<string[]>([])
  const [candidates, setCandidates] = React.useState<RecommendationCandidate[]>([])
  const [recommendations, setRecommendations] = React.useState<Recommendation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [running, setRunning] = React.useState<OperationKey | null>(null)
  const [result, setResult] = React.useState<RecommendationOperationResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const loadPage = React.useCallback(async () => {
    setLoading(true)
      setError(null)
      try {
        const [nextWeeks, nextCandidates, nextRecommendations] = await Promise.all([
        adminApi.recommendationWeeks(token!),
        adminApi.recommendationCandidates(token!, selectedWeek),
        adminApi.recommendations(token!, selectedWeek),
      ])
      setCollectedWeeks(nextWeeks)
      setCandidates(nextCandidates)
      setRecommendations(nextRecommendations)
    } catch {
      setError("Failed to load recommendations. Check admin-api logs for details.")
    } finally {
      setLoading(false)
    }
  }, [selectedWeek, token])

  React.useEffect(() => {
    void loadPage()
  }, [loadPage])

  const changeWeek = React.useCallback((week: string) => {
    setSelectedWeek(week)
    setResult(null)
  }, [])

  // The current week stays selectable even before its candidates are collected.
  const weekOptions = React.useMemo(
    () => Array.from(new Set([...collectedWeeks, selectedWeek])).sort().reverse(),
    [collectedWeeks, selectedWeek],
  )

  const runOperation = React.useCallback(
    async () => {
      setRunning("prepare")
      setError(null)
      try {
        // Send the selected week so the operation cannot touch approved candidates
        // of another week that is not visible in this list.
        const nextResult = await adminApi.prepareApprovedRecommendations(token!, selectedWeek)
        setResult(nextResult)
        if (nextResult.items.some((item) => item.recommendationId !== null)) {
          setActiveStage("recommendations")
        }
        await loadPage()
      } catch (error) {
        if (error instanceof ApiError && isRecommendationOperationResult(error.data)) {
          setResult(error.data)
          setError("Some approved candidates are missing analyzed songs. Request analysis for missing candidates, then process approved again.")
        } else {
          setError("Operation failed. Check admin-api logs for details.")
        }
      } finally {
        setRunning(null)
      }
    },
    [loadPage, selectedWeek, token],
  )

  const requestMissingAnalysis = React.useCallback(
    async (candidateIds: number[]) => {
      setRunning("request-analysis")
      setError(null)
      try {
        const nextResult = await adminApi.requestRecommendationAnalysis(token!, candidateIds)
        setResult(nextResult)
        await loadPage()
      } catch {
        setError("Failed to request analysis. Check admin-api logs for details.")
      } finally {
        setRunning(null)
      }
    },
    [loadPage, token],
  )

  const updateCandidateStatus = React.useCallback(
    async (candidateId: number, status: string) => {
      const key = `candidate-${candidateId}-${status}` as const
      setRunning(key)
      setError(null)
      try {
        await adminApi.updateRecommendationCandidateStatus(token!, candidateId, status)
        await loadPage()
      } catch {
        setError("Failed to update candidate status. Check admin-api logs for details.")
      } finally {
        setRunning(null)
      }
    },
    [loadPage, token],
  )

  const updateRecommendation = React.useCallback(
    async (recommendationId: number, payload: { status?: string; orderIndex?: number }) => {
      const key = `recommendation-${recommendationId}-${payload.status ?? "order"}` as const
      setRunning(key)
      setError(null)
      try {
        await adminApi.updateRecommendation(token!, recommendationId, payload)
        await loadPage()
      } catch {
        setError("Failed to update recommendation. Check readiness gates or admin-api logs.")
      } finally {
        setRunning(null)
      }
    },
    [loadPage, token],
  )

  const pendingCandidateCount = candidates.filter((candidate) => candidate.status === "PENDING").length
  const approvedCount = candidates.filter((candidate) => candidate.status === "APPROVED").length
  const pendingRecommendationCount = recommendations.filter((recommendation) => recommendation.status === "PENDING").length
  const publishedCount = recommendations.filter((recommendation) => recommendation.status === "PUBLISHED").length
  const candidateById = React.useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate])),
    [candidates],
  )

  return (
    <>
      <PageHeader
        title="Recommendations"
        meta="Move songs from Apple RSS candidate review into published home recommendations"
      />

      <WeekSelector
        selectedWeek={selectedWeek}
        weekOptions={weekOptions}
        collectedWeeks={collectedWeeks}
        disabled={loading || running !== null}
        onWeekChange={changeWeek}
      />

      <StageTabs
        activeStage={activeStage}
        onStageChange={setActiveStage}
        pendingCandidateCount={pendingCandidateCount}
        approvedCount={approvedCount}
        pendingRecommendationCount={pendingRecommendationCount}
        publishedCount={publishedCount}
      />

      {error ? (
        <div className="mb-4 rounded-md border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#991b1b]">
          {error}
        </div>
      ) : null}

      {activeStage === "candidates" ? (
        <CandidateStage
          candidates={candidates}
          selectedWeek={selectedWeek}
          loading={loading}
          running={running}
          result={result}
          onRefresh={loadPage}
          onRunOperation={runOperation}
          onRequestMissingAnalysis={requestMissingAnalysis}
          onUpdateCandidateStatus={updateCandidateStatus}
        />
      ) : (
        <RecommendationStage
          recommendations={recommendations}
          candidateById={candidateById}
          selectedWeek={selectedWeek}
          loading={loading}
          running={running}
          onRefresh={loadPage}
          onUpdateRecommendation={updateRecommendation}
        />
      )}
    </>
  )
}

function WeekSelector({
  selectedWeek,
  weekOptions,
  collectedWeeks,
  disabled,
  onWeekChange,
}: {
  selectedWeek: string
  weekOptions: string[]
  collectedWeeks: string[]
  disabled: boolean
  onWeekChange: (week: string) => void
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-[#d9e1ea] bg-white px-4 py-3">
      <label className="text-xs font-medium uppercase tracking-normal text-[#637083]" htmlFor="recommendation-week">
        Week
      </label>
      <select
        id="recommendation-week"
        className="focus-ring h-9 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"
        value={selectedWeek}
        disabled={disabled}
        onChange={(event) => onWeekChange(event.target.value)}
      >
        {weekOptions.map((week) => (
          <option key={week} value={week}>
            {week}
            {collectedWeeks.includes(week) ? "" : " (not collected)"}
          </option>
        ))}
      </select>
    </div>
  )
}

function StageTabs({
  activeStage,
  onStageChange,
  pendingCandidateCount,
  approvedCount,
  pendingRecommendationCount,
  publishedCount,
}: {
  activeStage: Stage
  onStageChange: (stage: Stage) => void
  pendingCandidateCount: number
  approvedCount: number
  pendingRecommendationCount: number
  publishedCount: number
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-[#637083]">
        <span>Workflow</span>
        <ArrowRight className="h-3.5 w-3.5" />
        <span>Candidate to recommendation</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2" role="tablist" aria-label="Recommendation workflow stages">
        <StageTab
          stage="candidates"
          activeStage={activeStage}
          onStageChange={onStageChange}
          title="Recommendation candidate"
          description="Review Apple RSS songs and move approved candidates forward."
          stats={`${pendingCandidateCount} pending · ${approvedCount} approved`}
          shape="first"
        />
        <StageTab
          stage="recommendations"
          activeStage={activeStage}
          onStageChange={onStageChange}
          title="Recommendation"
          description="Order prepared songs and publish them to the user home."
          stats={`${pendingRecommendationCount} pending · ${publishedCount} published`}
          shape="last"
        />
      </div>
    </div>
  )
}

function StageTab({
  stage,
  activeStage,
  onStageChange,
  title,
  description,
  stats,
  shape,
}: {
  stage: Stage
  activeStage: Stage
  onStageChange: (stage: Stage) => void
  title: string
  description: string
  stats: string
  shape: "first" | "last"
}) {
  const active = activeStage === stage
  const clipPath =
    shape === "first"
      ? "polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%)"
      : "polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%, 22px 50%)"

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onStageChange(stage)}
      className={[
        "focus-ring min-h-28 px-6 py-4 text-left transition-colors",
        active
          ? "bg-[#0f766e] text-white shadow-sm"
          : "bg-white text-[#18212f] ring-1 ring-inset ring-[#d9e1ea] hover:bg-[#f8fafc]",
      ].join(" ")}
      style={{ clipPath }}
    >
      <div className={active ? "text-xs font-semibold uppercase text-[#ccfbf1]" : "text-xs font-semibold uppercase text-[#0f766e]"}>
        {stats}
      </div>
      <div className="mt-2 text-base font-semibold">{title}</div>
      <div className={active ? "mt-1 text-sm text-[#d9fffa]" : "mt-1 text-sm text-[#637083]"}>
        {description}
      </div>
    </button>
  )
}

function CandidateStage({
  candidates,
  selectedWeek,
  loading,
  running,
  result,
  onRefresh,
  onRunOperation,
  onRequestMissingAnalysis,
  onUpdateCandidateStatus,
}: {
  candidates: RecommendationCandidate[]
  selectedWeek: string
  loading: boolean
  running: OperationKey | null
  result: RecommendationOperationResult | null
  onRefresh: () => void
  onRunOperation: () => void
  onRequestMissingAnalysis: (candidateIds: number[]) => void
  onUpdateCandidateStatus: (candidateId: number, status: string) => void
}) {
  const missingCandidateIds = React.useMemo(
    () =>
      result?.items
        .filter((item) => item.status === "MISSING_SONG" || item.status === "MISSING_ANALYZED_LYRIC")
        .map((item) => item.candidateId) ?? [],
    [result],
  )

  return (
    <>
      <section className="mb-4 rounded-lg border border-[#d9e1ea] bg-white p-4">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#18212f]">Candidate operations</h2>
            <p className="mt-1 text-sm text-[#637083]">
              Approve or reject RSS candidates, then run the next candidate-side operation.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" variant="secondary" onClick={onRefresh} disabled={loading || running !== null}>
              <RefreshCw className="h-4 w-4" />
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="grid max-w-xl gap-3">
          <OperationCard
            title="Process approved"
            description="Create pending recommendations only when every approved candidate has a matching analyzed song."
            buttonLabel={running === "prepare" ? "Processing..." : "Process approved"}
            disabled={running !== null}
            onClick={onRunOperation}
            primary
          />
        </div>

        {result ? (
          <OperationResultSummary
            result={result}
            missingCandidateIds={missingCandidateIds}
            running={running}
            onRequestMissingAnalysis={onRequestMissingAnalysis}
          />
        ) : null}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[#18212f]">Candidate list</h2>
          <p className="mt-1 text-sm text-[#637083]">
            Week of {selectedWeek}, ordered by Apple RSS rank.
          </p>
        </div>
        {candidates.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Rank</Th>
                <Th>Song</Th>
                <Th>Artist</Th>
                <Th>Status</Th>
                <Th>Review</Th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-[#f9fbfc]">
                  <Td className="font-mono text-xs text-[#637083]">{candidate.sourceRank}</Td>
                  <Td>
                    {candidate.sourceUrl ? (
                      <a className="font-medium text-[#18212f] underline-offset-2 hover:underline" href={candidate.sourceUrl} target="_blank" rel="noreferrer">
                        {candidate.title}
                      </a>
                    ) : (
                      <span className="font-medium text-[#18212f]">{candidate.title}</span>
                    )}
                    <div className="mt-1 font-mono text-xs text-[#94a3b8]">#{candidate.id} · {candidate.weekStartDate}</div>
                  </Td>
                  <Td>{candidate.artistName}</Td>
                  <Td>
                    <Badge tone={candidateTone(candidate.status)}>{candidate.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onUpdateCandidateStatus(candidate.id, "APPROVED")}
                        disabled={running !== null || candidate.status === "APPROVED"}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onUpdateCandidateStatus(candidate.id, "REJECTED")}
                        disabled={running !== null || candidate.status === "REJECTED"}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState loading={loading} message="No recommendation candidates found." />
        )}
      </section>
    </>
  )
}

function RecommendationStage({
  recommendations,
  candidateById,
  selectedWeek,
  loading,
  running,
  onRefresh,
  onUpdateRecommendation,
}: {
  recommendations: Recommendation[]
  candidateById: Map<number, RecommendationCandidate>
  selectedWeek: string
  loading: boolean
  running: OperationKey | null
  onRefresh: () => void
  onUpdateRecommendation: (recommendationId: number, payload: { status?: string; orderIndex?: number }) => void
}) {
  return (
    <section>
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#18212f]">Recommendation list</h2>
          <p className="mt-1 text-sm text-[#637083]">
            Week of {selectedWeek}. Order prepared recommendations and publish only the rows that should appear on the user home.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={onRefresh} disabled={loading || running !== null}>
          <RefreshCw className="h-4 w-4" />
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
      {recommendations.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Song</Th>
              <Th>Status</Th>
              <Th>Song/Lyric</Th>
              <Th>Publish</Th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((recommendation) => {
              const candidate = candidateById.get(recommendation.candidateId)
              return (
                <tr key={recommendation.id} className="hover:bg-[#f9fbfc]">
                  <Td>
                    <input
                      className="focus-ring h-9 w-20 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm text-[#18212f]"
                      type="number"
                      min={0}
                      defaultValue={recommendation.orderIndex}
                      onBlur={(event) => {
                        const nextOrder = Number(event.target.value)
                        if (Number.isInteger(nextOrder) && nextOrder >= 0 && nextOrder !== recommendation.orderIndex) {
                          void onUpdateRecommendation(recommendation.id, { orderIndex: nextOrder })
                        }
                      }}
                    />
                  </Td>
                  <Td>
                    <div className="font-medium text-[#18212f]">{candidate?.title ?? `Candidate #${recommendation.candidateId}`}</div>
                    <div className="mt-1 text-xs text-[#637083]">{candidate?.artistName ?? "-"} · rec #{recommendation.id}</div>
                  </Td>
                  <Td>
                    <Badge tone={recommendationTone(recommendation.status)}>{recommendation.status}</Badge>
                  </Td>
                  <Td>
                    {recommendation.songId} / {recommendation.lyricId}
                  </Td>
                  <Td>
                    {recommendation.status === "PUBLISHED" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onUpdateRecommendation(recommendation.id, { status: "PENDING" })}
                        disabled={running !== null}
                      >
                        Unpublish
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => onUpdateRecommendation(recommendation.id, { status: "PUBLISHED" })}
                        disabled={running !== null}
                      >
                        Publish
                      </Button>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState loading={loading} message="No pending or published recommendations found. Process approved candidates first." />
      )}
    </section>
  )
}

function OperationCard({
  title,
  description,
  buttonLabel,
  disabled,
  onClick,
  primary = false,
}: {
  title: string
  description: string
  buttonLabel: string
  disabled: boolean
  onClick: () => void
  primary?: boolean
}) {
  return (
    <div className={primary ? "rounded-lg border border-[#99f6e4] bg-[#f0fdfa] p-3" : "rounded-lg border border-[#d9e1ea] bg-[#f8fafc] p-3"}>
      <div className="text-sm font-semibold text-[#18212f]">{title}</div>
      <p className="mt-1 min-h-10 text-sm text-[#637083]">{description}</p>
      <Button type="button" variant={primary ? "default" : "secondary"} onClick={onClick} disabled={disabled} className="mt-3">
        {buttonLabel}
      </Button>
    </div>
  )
}

function OperationResultSummary({
  result,
  missingCandidateIds,
  running,
  onRequestMissingAnalysis,
}: {
  result: RecommendationOperationResult
  missingCandidateIds: number[]
  running: OperationKey | null
  onRequestMissingAnalysis: (candidateIds: number[]) => void
}) {
  return (
    <div className="mt-4 rounded-md border border-[#d9e1ea] bg-white p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-normal text-[#637083]">Last operation</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <ResultPill label="Processed" value={result.processed} />
        <ResultPill label="Succeeded" value={result.succeeded} />
        <ResultPill label="Skipped" value={result.skipped} />
        <ResultPill label="Failed" value={result.failed} />
      </div>
      {result.items.length > 0 ? (
        <div className="mt-3 text-sm text-[#637083]">
          Last item: candidate #{result.items[0].candidateId} · {result.items[0].status}
          {result.items[0].songId ? ` · song #${result.items[0].songId}` : ""}
          {result.items[0].lyricId ? ` · lyric #${result.items[0].lyricId}` : ""}
          {result.items[0].message ? ` · ${result.items[0].message}` : ""}
        </div>
      ) : null}
      {missingCandidateIds.length > 0 ? (
        <Button
          type="button"
          variant="secondary"
          disabled={running !== null}
          onClick={() => onRequestMissingAnalysis(missingCandidateIds)}
          className="mt-3"
        >
          {running === "request-analysis" ? "Requesting..." : `Request analysis for ${formatNumber(missingCandidateIds.length)} missing`}
        </Button>
      ) : null}
    </div>
  )
}

function ResultPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-[#f8fafc] px-3 py-2">
      <div className="text-xs text-[#637083]">{label}</div>
      <div className="font-semibold text-[#18212f]">{formatNumber(value)}</div>
    </div>
  )
}

function EmptyState({ loading = false, message }: { loading?: boolean; message: string }) {
  return (
    <div className="border-y border-[#d9e1ea] bg-white px-4 py-10 text-center text-sm text-[#637083]">
      {loading ? "Loading..." : message}
    </div>
  )
}

function candidateTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "APPROVED") return "success"
  if (status === "REJECTED") return "danger"
  if (status === "PENDING") return "warning"
  return "neutral"
}

function recommendationTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "PUBLISHED") return "success"
  if (status === "PENDING") return "warning"
  return "neutral"
}

function isRecommendationOperationResult(value: unknown): value is RecommendationOperationResult {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<RecommendationOperationResult>
  return typeof candidate.processed === "number" && Array.isArray(candidate.items)
}
