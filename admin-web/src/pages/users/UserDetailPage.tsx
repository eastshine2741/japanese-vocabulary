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
import { EmptyState, ErrorState, LoadingState } from "@/components/StateViews"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, Td, Th } from "@/components/ui/table"
import { PageHeader } from "@/components/PageHeader"
import { PaginationBar } from "@/components/PaginationBar"
import { useAuth } from "@/features/auth"
import { cn, formatDateTime, formatNumber } from "@/lib/utils"

const deckKindTone: Record<AdminUserDeckKind, "neutral" | "success" | "warning"> = {
  DEFAULT: "neutral",
  SONG: "success",
  CUSTOM: "warning",
}

const flashcardTone: Record<AdminWordFlashcardStatus, "neutral" | "warning" | "success"> = {
  NEW: "neutral",
  STUDYING: "warning",
  MASTERED: "success",
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

      <SectionTitle>Learning</SectionTitle>
      <LearningStats learning={learning} />

      <SectionTitle>Decks</SectionTitle>
      <DecksTable decks={decks} selectedDeckId={deckId} onSelect={setDeckId} />

      <SectionTitle>Words</SectionTitle>
      <WordsTable userId={userId} decks={decks} deckId={deckId} onDeckChange={setDeckId} />
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 text-base font-semibold text-[#18212f]">{children}</h2>
}

function LearningStats({ learning }: { learning: AdminUserLearning }) {
  const stats: { label: string; value: React.ReactNode }[] = [
    { label: "Words", value: formatNumber(learning.wordCount) },
    { label: "Due now", value: formatNumber(learning.dueCount) },
    { label: "New", value: formatNumber(learning.newCount) },
    { label: "Studying", value: formatNumber(learning.studyingCount) },
    { label: "Mastered", value: formatNumber(learning.masteredCount) },
    { label: "Review days (30d)", value: formatNumber(learning.reviewDaysLast30) },
    { label: "Reviews (30d)", value: formatNumber(learning.reviewCountLast30) },
    { label: "Last saved", value: formatDateTime(learning.lastWordSavedAt) },
    { label: "Last review", value: formatDateTime(learning.lastReviewedAt) },
  ]
  return (
    <dl className="grid grid-cols-2 gap-px border border-[#d9e1ea] bg-[#d9e1ea] sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white px-4 py-3">
          <dt className="text-xs font-semibold uppercase text-[#637083]">{stat.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[#18212f]">{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
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
  if (decks.length === 0) return <EmptyState label="No decks." />
  return (
    <Table>
      <thead>
        <tr>
          <Th>ID</Th>
          <Th>Kind</Th>
          <Th>Title</Th>
          <Th>Song</Th>
          <Th className="text-right">Words</Th>
          <Th className="text-right">Due</Th>
          <Th className="text-right">New</Th>
          <Th className="text-right">Studying</Th>
          <Th className="text-right">Mastered</Th>
          <Th>Created</Th>
        </tr>
      </thead>
      <tbody>
        {decks.map((deck) => {
          const selected = deck.id === selectedDeckId
          return (
            <tr
              key={deck.id}
              className={cn("cursor-pointer", selected ? "bg-[#e6fffb]" : "hover:bg-[#f9fbfc]")}
              aria-selected={selected}
              onClick={() => onSelect(selected ? null : deck.id)}
            >
              <Td className="w-24 font-mono text-xs text-[#637083]">{deck.id}</Td>
              <Td>
                <Badge tone={deckKindTone[deck.kind]}>{deck.kind}</Badge>
              </Td>
              <Td className="font-medium">{deck.title}</Td>
              <Td>
                {deck.songId ? (
                  <Link
                    className="text-[#0f766e] hover:underline"
                    to={`/songs/${deck.songId}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {deck.songTitle ?? `Song #${deck.songId}`}
                    {deck.songArtist ? <span className="text-[#637083]"> · {deck.songArtist}</span> : null}
                  </Link>
                ) : (
                  "-"
                )}
              </Td>
              <Td className="text-right tabular-nums">{formatNumber(deck.wordCount)}</Td>
              <Td className="text-right tabular-nums">{formatNumber(deck.dueCount)}</Td>
              <Td className="text-right tabular-nums">{formatNumber(deck.newCount)}</Td>
              <Td className="text-right tabular-nums">{formatNumber(deck.studyingCount)}</Td>
              <Td className="text-right tabular-nums">{formatNumber(deck.masteredCount)}</Td>
              <Td>{formatDateTime(deck.createdAt)}</Td>
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
          aria-label="Deck filter"
          className="focus-ring h-9 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"
          value={deckId ?? ""}
          onChange={(event) => onDeckChange(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">All words</option>
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.kind} · {deck.title}
            </option>
          ))}
        </select>
        <Input placeholder="Japanese text or reading" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button type="submit" aria-label="Search words" title="Search words" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </form>
      {state === "loading" ? <LoadingState /> : null}
      {state === "error" ? <ErrorState label="Could not load words." /> : null}
      {state === "ready" && data?.content.length === 0 ? <EmptyState label="No words found." /> : null}
      {state === "ready" && data && data.content.length > 0 ? (
        <>
          <Table>
            <thead>
              <tr>
                <Th className="w-8" />
                <Th>Word</Th>
                <Th>Meaning</Th>
                <Th>JLPT</Th>
                <Th className="text-right">Examples</Th>
                <Th>Songs</Th>
                <Th>Review</Th>
                <Th>Due</Th>
                <Th>Saved</Th>
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
  return (
    <>
      <tr className="cursor-pointer hover:bg-[#f9fbfc]" onClick={onToggle} aria-expanded={expanded}>
        <Td className="w-8 pr-0 text-[#637083]">
          <Chevron className="h-4 w-4" />
        </Td>
        <Td>
          <div className="font-medium">{word.japaneseText}</div>
          {word.reading ? <div className="text-xs text-[#637083]">{word.reading}</div> : null}
        </Td>
        <Td>
          {first?.meaning ?? "-"}
          {rest.length > 0 ? <span className="ml-1 text-xs text-[#637083]">+{rest.length}</span> : null}
        </Td>
        <Td>{first?.jlpt ?? "-"}</Td>
        <Td className="text-right tabular-nums">{exampleCount}</Td>
        <Td>
          {word.sourceSongs.length === 0
            ? "-"
            : word.sourceSongs.map((song, index) => (
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
              ))}
        </Td>
        <Td>{word.flashcard ? <Badge tone={flashcardTone[word.flashcard.status]}>{word.flashcard.status}</Badge> : "-"}</Td>
        <Td>{formatDateTime(word.flashcard?.due)}</Td>
        <Td>{formatDateTime(word.createdAt)}</Td>
      </tr>
      {expanded ? (
        <tr className="bg-[#f9fbfc]">
          <Td />
          <Td colSpan={8} className="h-auto py-3 align-top">
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
                            <span className="ml-2 font-mono text-xs text-[#637083]">
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
                FSRS state {word.flashcard.fsrsState} · last review {formatDateTime(word.flashcard.lastReview)}
              </div>
            ) : null}
          </Td>
        </tr>
      ) : null}
    </>
  )
}
