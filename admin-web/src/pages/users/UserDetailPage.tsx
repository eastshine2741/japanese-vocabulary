import * as React from "react"
import { ChevronDown, ChevronRight, Search } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { adminApi } from "@/api/client"
import type {
  AdminUserDeck,
  AdminUserDeckKind,
  AdminUserDetail,
  AdminUserLearning,
  AdminUserWord,
  AdminWordFlashcardStatus,
  PageResponse,
} from "@/api/types"
import { DetailGrid, DetailItem } from "@/components/DetailGrid"
import { Count, MasteryBar, Recency, toneText } from "@/components/LearningStatus"
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, Td, Th } from "@/components/ui/table"
import { PageHeader } from "@/components/PageHeader"
import { PaginationBar } from "@/components/PaginationBar"
import { useAuth } from "@/features/auth"
import { cn, formatDateTime, formatNumber, formatRelativeDays } from "@/lib/utils"

/** 앱 문구 그대로: 전체 단어장 / 곡 단어장 / 일반(직접 만든) 단어장 */
const deckKind: Record<AdminUserDeckKind, { label: string; tone: "neutral" | "success" | "warning" }> = {
  DEFAULT: { label: "전체", tone: "neutral" },
  SONG: { label: "곡", tone: "success" },
  CUSTOM: { label: "일반", tone: "warning" },
}

/** 앱 진행도 범례와 같은 문구·색 */
const flashcardStatus: Record<AdminWordFlashcardStatus, { label: string; tone: "neutral" | "warning" | "success" }> = {
  NEW: { label: "새 단어", tone: "neutral" },
  STUDYING: { label: "외우는 중", tone: "warning" },
  MASTERED: { label: "외운 단어", tone: "success" },
}

export function UserDetailPage() {
  const { token } = useAuth()
  const { userId = "" } = useParams()
  const [detail, setDetail] = React.useState<AdminUserDetail | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")
  const [deckId, setDeckId] = React.useState<number | null>(null)

  React.useEffect(() => {
    let alive = true
    setState("loading")
    setDeckId(null)
    adminApi
      .user(token!, userId)
      .then((result) => {
        if (!alive) return
        setDetail(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [token, userId])

  if (state === "loading") return <LoadingState />
  if (state === "error" || !detail) return <ErrorState label="Could not load user." />

  const { user, learning, decks } = detail
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

      <SectionTitle>학습</SectionTitle>
      <LearningStats learning={learning} />

      <SectionTitle>단어장</SectionTitle>
      <DecksTable decks={decks} selectedDeckId={deckId} onSelect={setDeckId} />

      <SectionTitle>단어</SectionTitle>
      <WordsTable userId={userId} decks={decks} deckId={deckId} onDeckChange={setDeckId} />
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 text-base font-semibold text-[#18212f]">{children}</h2>
}

/**
 * 한눈에 답해야 하는 질문 순서대로: 단어를 저장하긴 했나 → 복습을 하고 있나 → 최근에도 하나.
 * 큰 숫자가 그 답이고, 나머지는 보조 정보라 작게 둔다.
 */
function LearningStats({ learning }: { learning: AdminUserLearning }) {
  if (learning.wordCount === 0) return <EmptyState label="저장한 단어가 없어요" />
  const dueTone = learning.dueCount > 0 ? toneText.warning : toneText.muted
  const reviewDaysTone = learning.reviewDaysLast30 > 0 ? toneText.success : toneText.muted
  return (
    <div className="grid grid-cols-1 gap-px border border-[#d9e1ea] bg-[#d9e1ea] sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="단어">
        <StatValue>{formatNumber(learning.wordCount)}</StatValue>
        <MasteryBar
          className="mt-3"
          legend
          total={learning.wordCount}
          mastered={learning.masteredCount}
          studying={learning.studyingCount}
          newCount={learning.newCount}
        />
      </StatCard>
      <StatCard label="복습할 단어">
        <StatValue className={dueTone}>{formatNumber(learning.dueCount)}</StatValue>
        <StatSub>
          마지막 복습 <Recency value={learning.lastReviewedAt} />
        </StatSub>
      </StatCard>
      <StatCard label="최근 30일 복습한 날">
        <StatValue className={reviewDaysTone}>
          {formatNumber(learning.reviewDaysLast30)}
          <span className="ml-0.5 text-sm font-medium text-[#637083]">일</span>
        </StatValue>
        <StatSub>
          복습 <Count value={learning.reviewCountLast30} />회
        </StatSub>
      </StatCard>
      <StatCard label="마지막 저장">
        <StatValue>
          <Recency value={learning.lastWordSavedAt} />
        </StatValue>
        <StatSub>{formatDateTime(learning.lastWordSavedAt)}</StatSub>
      </StatCard>
    </div>
  )
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="text-xs font-semibold text-[#637083]">{label}</div>
      {children}
    </div>
  )
}

function StatValue({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mt-1 text-2xl font-semibold tabular-nums text-[#18212f]", className)}>{children}</div>
}

function StatSub({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-xs text-[#637083]">{children}</div>
}

function DecksTable({
  decks,
  selectedDeckId,
  onSelect,
}: {
  decks: AdminUserDeck[]
  selectedDeckId: number | null
  onSelect(deckId: number | null): void
}) {
  if (decks.length === 0) return <EmptyState label="단어장이 없어요" />
  return (
    <Table>
      <thead>
        <tr>
          <Th>ID</Th>
          <Th>종류</Th>
          <Th>단어장</Th>
          <Th className="text-right">단어</Th>
          <Th className="text-right">복습할 단어</Th>
          <Th className="w-64">진행도</Th>
          <Th>만든 날짜</Th>
        </tr>
      </thead>
      <tbody>
        {decks.map((deck) => {
          const selected = deck.id === selectedDeckId
          const kind = deckKind[deck.kind]
          return (
            <tr
              key={deck.id}
              className={cn("cursor-pointer", selected ? "bg-[#e6fffb]" : "hover:bg-[#f9fbfc]")}
              aria-selected={selected}
              onClick={() => onSelect(selected ? null : deck.id)}
            >
              <Td className="w-20 font-mono text-xs text-[#9aa5b3]">{deck.id}</Td>
              <Td className="w-20">
                <Badge tone={kind.tone}>{kind.label}</Badge>
              </Td>
              <Td>
                {deck.songId ? (
                  <Link
                    className="font-medium text-[#0f766e] hover:underline"
                    to={`/songs/${deck.songId}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {deck.songTitle ?? `Song #${deck.songId}`}
                    {deck.songArtist ? <span className="font-normal text-[#637083]"> · {deck.songArtist}</span> : null}
                  </Link>
                ) : (
                  <span className="font-medium">{deck.title}</span>
                )}
              </Td>
              <Td className="text-right">
                <Count value={deck.wordCount} />
              </Td>
              <Td className="text-right">
                <Count value={deck.dueCount} accent="warning" />
              </Td>
              <Td>
                {deck.wordCount > 0 ? (
                  <div className="flex items-center gap-3">
                    <MasteryBar
                      className="w-24 shrink-0"
                      total={deck.wordCount}
                      mastered={deck.masteredCount}
                      studying={deck.studyingCount}
                      newCount={deck.newCount}
                    />
                    <span className="text-xs text-[#9aa5b3]">
                      <Count value={deck.masteredCount} accent="success" className="text-xs" /> ·{" "}
                      <Count value={deck.studyingCount} accent="warning" className="text-xs" /> ·{" "}
                      <Count value={deck.newCount} className="text-xs" />
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-[#9aa5b3]">-</span>
                )}
              </Td>
              <Td className="text-xs text-[#637083]">{formatDateTime(deck.createdAt)}</Td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}

function WordsTable({
  userId,
  decks,
  deckId,
  onDeckChange,
}: {
  userId: string
  decks: AdminUserDeck[]
  deckId: number | null
  onDeckChange(deckId: number | null): void
}) {
  const { token } = useAuth()
  const [page, setPage] = React.useState(0)
  const [query, setQuery] = React.useState("")
  const [submittedQuery, setSubmittedQuery] = React.useState("")
  const [data, setData] = React.useState<PageResponse<AdminUserWord> | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")
  const [expandedId, setExpandedId] = React.useState<number | null>(null)

  React.useEffect(() => {
    setPage(0)
  }, [deckId])

  React.useEffect(() => {
    let alive = true
    setState("loading")
    adminApi
      .userWords(token!, userId, page, { deckId, query: submittedQuery })
      .then((result) => {
        if (!alive) return
        setData(result)
        setState("ready")
      })
      .catch(() => alive && setState("error"))
    return () => {
      alive = false
    }
  }, [token, userId, page, deckId, submittedQuery])

  return (
    <>
      <form
        className="mb-3 flex max-w-2xl gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(0)
          setSubmittedQuery(query)
        }}
      >
        <select
          aria-label="단어장 필터"
          className="focus-ring h-9 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"
          value={deckId ?? ""}
          onChange={(event) => onDeckChange(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">전체 단어</option>
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deckKind[deck.kind].label} · {deck.title}
            </option>
          ))}
        </select>
        <Input placeholder="일본어 또는 읽기" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button type="submit" aria-label="단어 검색" title="단어 검색" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </form>
      {state === "loading" ? <LoadingState /> : null}
      {state === "error" ? <ErrorState label="Could not load words." /> : null}
      {state === "ready" && data?.content.length === 0 ? <EmptyState label="단어가 없어요" /> : null}
      {state === "ready" && data && data.content.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th className="w-8" />
                <Th>단어</Th>
                <Th>뜻</Th>
                <Th>상태</Th>
                <Th>다음 복습</Th>
                <Th>곡</Th>
                <Th className="text-right">예문</Th>
                <Th>저장</Th>
              </tr>
            </thead>
            <tbody>
              {data.content.map((word) => (
                <WordRow
                  key={word.id}
                  word={word}
                  expanded={expandedId === word.id}
                  onToggle={() => setExpandedId((current) => (current === word.id ? null : word.id))}
                />
              ))}
            </tbody>
          </Table>
          <PaginationBar page={data} onPage={setPage} />
        </>
      ) : null}
    </>
  )
}

function WordRow({ word, expanded, onToggle }: { word: AdminUserWord; expanded: boolean; onToggle(): void }) {
  const [first, ...rest] = word.senses
  const exampleCount = word.senses.reduce((sum, sense) => sum + sense.examples.length, 0)
  const Chevron = expanded ? ChevronDown : ChevronRight
  const status = word.flashcard ? flashcardStatus[word.flashcard.status] : null
  return (
    <>
      <tr className="cursor-pointer hover:bg-[#f9fbfc]" onClick={onToggle} aria-expanded={expanded}>
        <Td className="w-8 pr-0 text-[#9aa5b3]">
          <Chevron className="h-4 w-4" />
        </Td>
        <Td>
          <div className="text-base font-semibold text-[#18212f]">{word.japaneseText}</div>
          {word.reading ? <div className="text-xs text-[#637083]">{word.reading}</div> : null}
        </Td>
        <Td>
          <span className="text-[#18212f]">{first?.meaning ?? "-"}</span>
          {rest.length > 0 ? <span className="ml-1 text-xs text-[#9aa5b3]">+{rest.length}</span> : null}
          {first?.jlpt ? <span className="ml-2 text-xs text-[#9aa5b3]">{first.jlpt}</span> : null}
        </Td>
        <Td>{status ? <Badge tone={status.tone}>{status.label}</Badge> : <span className="text-[#9aa5b3]">-</span>}</Td>
        <Td>
          <DueCell due={word.flashcard?.due} />
        </Td>
        <Td>
          {word.sourceSongs.length === 0 ? (
            <span className="text-[#9aa5b3]">-</span>
          ) : (
            word.sourceSongs.map((song, index) => (
              <React.Fragment key={song.id}>
                {index > 0 ? ", " : null}
                <Link
                  className="text-[#0f766e] hover:underline"
                  to={`/songs/${song.id}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  {song.title}
                </Link>
              </React.Fragment>
            ))
          )}
        </Td>
        <Td className="text-right">
          <Count value={exampleCount} className="text-xs" />
        </Td>
        <Td>
          <Recency value={word.createdAt} className="text-xs text-[#637083]" />
        </Td>
      </tr>
      {expanded ? (
        <tr className="bg-[#f9fbfc]">
          <Td />
          <Td colSpan={7} className="h-auto py-3 align-top">
            <ol className="flex flex-col gap-3">
              {word.senses.map((sense, index) => (
                <li key={`${sense.meaning}-${index}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{sense.meaning}</span>
                    {sense.partOfSpeech ? <span className="text-xs text-[#637083]">{sense.partOfSpeech}</span> : null}
                    {sense.jlpt ? <Badge>{sense.jlpt}</Badge> : null}
                  </div>
                  {sense.examples.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-1 border-l-2 border-[#d9e1ea] pl-3 text-sm">
                      {sense.examples.map((example, exampleIndex) => (
                        <li key={`${example.text}-${exampleIndex}`}>
                          <span>{example.text}</span>
                          {example.translation ? <span className="text-[#637083]"> — {example.translation}</span> : null}
                          {example.songId != null ? (
                            <span className="ml-2 font-mono text-xs text-[#9aa5b3]">
                              song {example.songId}
                              {example.lineIndex != null ? ` · line ${example.lineIndex}` : null}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
            {word.flashcard ? (
              <div className="mt-3 text-xs text-[#637083]">
                FSRS state {word.flashcard.fsrsState} · 다음 복습 {formatDateTime(word.flashcard.due)} · 마지막 복습{" "}
                {formatDateTime(word.flashcard.lastReview)} · 저장 {formatDateTime(word.createdAt)}
              </div>
            ) : null}
          </Td>
        </tr>
      ) : null}
    </>
  )
}

/** 복습 시점이 지났으면 "지금" 으로 강조, 아직이면 남은 기간을 흐리게. */
function DueCell({ due }: { due?: string | null }) {
  if (!due) return <span className="text-[#9aa5b3]">-</span>
  const overdue = new Date(due).getTime() <= Date.now()
  return (
    <span
      className={cn("text-xs tabular-nums", overdue ? cn("font-semibold", toneText.warning) : "text-[#637083]")}
      title={formatDateTime(due)}
    >
      {overdue ? "지금" : formatRelativeDays(due)}
    </span>
  )
}
