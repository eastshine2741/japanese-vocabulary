import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { App } from "@/App"
import {
  adminUser,
  lyricDetail,
  lyricSummary,
  page,
  recommendationOperationResult,
  songAnalysisWorkDetail,
  songAnalysisWorkSummary,
  songDetail,
  songSummary,
} from "@/test/page-fixtures"

function mockFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/auth/login")) {
      const body = JSON.parse(String(init?.body))
      return json(body.password === "secret" ? { token: "admin-token", expiresAt: "2026-01-01T01:00:00Z" } : {}, body.password === "secret" ? 200 : 401)
    }
    if (url.includes("/songs/1")) return json(songDetail)
    if (url.includes("/songs?")) return json(page([songSummary]))
    if (url.includes("/song-analysis-works/4")) return json(songAnalysisWorkDetail)
    if (url.includes("/song-analysis-works?")) return json(page([songAnalysisWorkSummary]))
    if (url.includes("/recommendations/dispatch-analysis")) return json(recommendationOperationResult)
    if (url.includes("/recommendations/reconcile-completed")) return json(recommendationOperationResult)
    if (url.includes("/lyrics/2")) return json(lyricDetail)
    if (url.includes("/lyrics?")) return json(page([lyricSummary]))
    if (url.includes("/users/3")) return json(adminUser)
    if (url.includes("/users?")) return json(page([adminUser]))
    return json({}, 404)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
  mockFetch()
})

describe("admin web", () => {
  test("protects entity routes and logs in with sessionStorage token", async () => {
    const user = userEvent.setup()
    renderApp("/songs")

    expect(screen.getByRole("heading", { name: "Kotonoha Admin" })).toBeInTheDocument()
    await user.type(screen.getByLabelText("Password"), "secret")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => expect(sessionStorage.getItem("kotonoha.admin.token")).toBe("admin-token"))
    expect(await screen.findByRole("heading", { name: "Songs" })).toBeInTheDocument()
  })

  test("renders entity navigation and list rows", async () => {
    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/songs")

    expect(await screen.findByText("夜に駆ける")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Lyrics" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Recommendations" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Analysis Work" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument()
  })

  test("runs recommendation manual operations", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/recommendations")

    expect(await screen.findByRole("heading", { name: "Recommendations" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Dispatch analysis" }))

    expect(await screen.findByText("Processed")).toBeInTheDocument()
    expect(screen.getByText("SUCCEEDED")).toBeInTheDocument()
    expect(screen.getByText("10")).toBeInTheDocument()
  })

  test("renders detail pages without write controls", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/lyrics/2")

    expect(await screen.findByRole("button", { name: "Copy raw JSON" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy analyzed JSON" })).toBeInTheDocument()
    expect(screen.getByText("가라앉듯이 녹아가듯이")).toBeInTheDocument()
    expect(screen.queryByText(/"koreanLyrics"/)).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Inspect 沈む" }))
    expect(screen.getByText("가라앉다")).toBeInTheDocument()
    expect(screen.getByText("Base form")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /\b(Edit|Delete|Save|Create)\b/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/\b(Edit|Delete|Save|Create)\b/i)).not.toBeInTheDocument()
  })

  test("renders song analysis work milestones", async () => {
    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/song-analysis-works/4")

    expect(await screen.findByRole("heading", { name: "Work #4" })).toBeInTheDocument()
    expect(screen.getByText("Elapsed time")).toBeInTheDocument()
    expect(screen.getByText("Created to player ready")).toBeInTheDocument()
    expect(screen.getByText("2m 00s")).toBeInTheDocument()
  })
})
