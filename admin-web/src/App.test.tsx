import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { App } from "@/App"
import {
  adminUser,
  adminUserDetail,
  adminUserWord,
  lyricDetail,
  page,
  recommendation,
  reelsSongCandidate,
  reelsSongDetail,
  failedSongAnalysisWorkDetail,
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
    if (url.includes("/reels-factory/render")) return new Response(new Blob(["mp4"], { type: "video/mp4" }), { status: 200 })
    // 이전에 올려 둔 MV 가 서버 캐시에 남아 있는 상황
    if (url.endsWith("/reels-factory/songs/1/source")) return json({ mvPath: "/reels-factory/songs/1/mv?token=media" })
    if (url.includes("/reels-factory/songs/1")) return json(reelsSongDetail)
    if (url.includes("/reels-factory/songs?")) return json(page([reelsSongCandidate]))
    if (url.endsWith("/songs/1/reanalysis") && init?.method === "POST") return json(pendingReanalysisWork)
    if (url.endsWith("/songs/1/lyric")) return json(lyricDetail)
    if (url.includes("/songs/1")) return json(songDetail)
    if (url.includes("/songs?")) return json(page([songSummary]))
    if (url.includes("/song-analysis-works/4")) return json(songAnalysisWorkDetail)
    if (url.endsWith("/song-analysis-works/5/resume") && init?.method === "POST") {
      return json({ ...failedSongAnalysisWorkDetail, status: "PENDING", resumable: false, errorCode: null, errorMessage: null })
    }
    if (url.endsWith("/song-analysis-works/5/stages/ANALYZE_LYRICS/output")) return json({ translation: { "0": { index: 0, koreanLyrics: "고양이" } } })
    if (url.includes("/song-analysis-works/5")) return json(failedSongAnalysisWorkDetail)
    if (url.includes("/song-analysis-works?")) return json(page([songAnalysisWorkSummary]))
    if (url.endsWith("/recommendations/order") && init?.method === "PUT") return json(JSON.parse(String(init.body)).ids.map((id: number) => ({ ...recommendation, id })))
    if (url.endsWith("/recommendations/11") && init?.method === "DELETE") return new Response(null, { status: 204 })
    if (url.endsWith("/recommendations") && init?.method === "POST") return json({ error: "already recommended" }, 409)
    if (url.endsWith("/recommendations")) return json([recommendation])
    if (url.includes("/lyrics/2")) return json(lyricDetail)
    if (url.includes("/users/3/words")) {
      const words = new URL(url).searchParams.get("deckId") === "11" ? [adminUserWord] : [adminUserWord, { ...adminUserWord, id: 21, japaneseText: "夜", reading: "ヨル", senses: [{ meaning: "밤", partOfSpeech: "명사", jlpt: "N5", examples: [] }], sourceSongs: [], flashcard: { status: "NEW", fsrsState: 0, due: "2026-01-01T00:00:00Z", lastReview: null } }]
      return json(page(words))
    }
    if (url.endsWith("/push/send") && init?.method === "POST") return json({ userId: 3, targetTokens: 2, sent: 1, failed: 1 })
    if (url.includes("/users/3")) return json(adminUserDetail)
    if (url.includes("/users?")) return json(page([adminUser]))
    return json({}, 404)
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}


const pendingReanalysisWork = {
  ...songAnalysisWorkSummary,
  id: 7,
  status: "PENDING",
  triggerSource: "ADMIN",
  lyricId: null,
  youtubeUrl: "https://youtu.be/new-mv",
}

const songDetailWithReanalysisHistory = {
  ...songDetail,
  activeReanalysisWork: null,
  analysisWorks: [pendingReanalysisWork],
}

const songDetailWithActiveBlocker = {
  ...songDetail,
  activeReanalysisWork: pendingReanalysisWork,
  analysisWorks: [pendingReanalysisWork],
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
    expect(screen.queryByRole("link", { name: "Lyrics" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Recommendations" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Analysis Work" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Reels Factory" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument()
  })

  test("shows user learning activity in list and detail", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/users")

    // 목록: 단어 수와 단어장 수(곡 + 일반)
    const row = (await screen.findByText("adminread")).closest("tr")!
    expect(row).toHaveTextContent("2")
    expect(row).toHaveTextContent("1 + 0")

    await user.click(screen.getByRole("link", { name: "adminread" }))

    // 상세: 학습 요약, 단어장, 단어
    expect(await screen.findByRole("heading", { name: "학습" })).toBeInTheDocument()
    expect(screen.getByText("최근 30일 복습한 날").nextElementSibling).toHaveTextContent("3일")
    expect(screen.getByText("전체 단어장")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /夜に駆ける · YOASOBI/ })).toHaveAttribute("href", "/songs/1")
    expect(await screen.findByText("駆ける")).toBeInTheDocument()
    expect(screen.getByText("夜")).toBeInTheDocument()
    expect(screen.getByText("외운 단어", { selector: "span" })).toBeInTheDocument()
    expect(screen.getByText("새 단어", { selector: "span" })).toBeInTheDocument()

    // 단어 행 펼치면 뜻 전체와 예문
    await user.click(screen.getByText("駆ける"))
    expect(await screen.findByText("뛰다")).toBeInTheDocument()
    expect(screen.getByText("夜に駆ける", { selector: "li span" })).toBeInTheDocument()

    // 단어장 행 클릭 → 그 단어장으로 필터
    await user.click(screen.getByText("곡", { selector: "span" }).closest("tr")!)
    await waitFor(() => expect(screen.queryByText("夜")).not.toBeInTheDocument())
    expect(screen.getByLabelText("단어장 필터")).toHaveValue("11")
    expect(screen.getByText("駆ける")).toBeInTheDocument()
  })

  test("sends a manual push from user detail", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)
    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/users/3")

    const send = await screen.findByRole("button", { name: "보내기" })
    expect(send).toBeDisabled()
    await user.type(screen.getByLabelText("푸시 제목"), "공지")
    await user.type(screen.getByLabelText("푸시 내용"), "오늘도 복습해요")
    await user.click(send)

    expect(await screen.findByText(/기기 2대 중/)).toHaveTextContent("기기 2대 중 1 성공 · 1 실패")
    const call = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/push/send"))!
    expect(JSON.parse(String(call[1]?.body))).toEqual({ userId: 3, title: "공지", body: "오늘도 복습해요" })
  })

  test("lists recommendations, blocks duplicate adds, and removes", async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch()
    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/recommendations")

    expect(await screen.findByRole("heading", { name: "Recommendations" })).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Remove 夜に駆ける" })).toBeInTheDocument()

    await user.type(screen.getByLabelText("Song search"), "夜")
    expect(await screen.findByRole("button", { name: "Added 夜に駆ける" })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Remove 夜に駆ける" }))
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input, init]) => String(input).endsWith("/recommendations/11") && init?.method === "DELETE")).toBe(true),
    )
  })

  test("song detail embeds the active lyric without write controls", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/songs/1")

    expect(await screen.findByRole("heading", { name: "夜に駆ける" })).toBeInTheDocument()
    expect(await screen.findByRole("heading", { name: "Lyric" })).toBeInTheDocument()
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


  test("song detail exposes admin reanalysis action and work-produced MV history", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/songs/1/reanalysis") && init?.method === "POST") return json(pendingReanalysisWork)
      if (url.endsWith("/songs/1/lyric")) return json({}, 404)
      if (url.includes("/songs/1")) return json(songDetailWithReanalysisHistory)
      return json({}, 404)
    })

    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/songs/1")

    expect(await screen.findByRole("button", { name: /trigger reanalysis/i })).toBeInTheDocument()
    expect(screen.getByText(/recent analysis works/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /work #7/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /new mv/i })).toHaveAttribute("href", "https://youtu.be/new-mv")
  })

  test("song detail posts reanalysis and disables duplicate trigger when active work blocks", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/songs/1/reanalysis") && init?.method === "POST") return json(pendingReanalysisWork)
      if (url.endsWith("/songs/1/lyric")) return json({}, 404)
      if (url.includes("/songs/1")) return json(songDetailWithActiveBlocker)
      return json({}, 404)
    })

    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    const { unmount } = renderApp("/songs/1")

    const trigger = await screen.findByRole("button", { name: /trigger reanalysis/i })
    expect(trigger).toBeDisabled()
    expect(screen.getByText(/active reanalysis work/i)).toBeInTheDocument()

    unmount()
    fetchMock.mockClear()
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/songs/1/reanalysis") && init?.method === "POST") return json(pendingReanalysisWork)
      if (url.endsWith("/songs/1/lyric")) return json({}, 404)
      if (url.includes("/songs/1")) return json(songDetailWithReanalysisHistory)
      return json({}, 404)
    })
    renderApp("/songs/1")

    await user.click(await screen.findByRole("button", { name: /trigger reanalysis/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/songs/1/reanalysis"), expect.objectContaining({ method: "POST" })))
    expect(await screen.findByText(/reanalysis work #7/i)).toBeInTheDocument()
  })

  test("renders song analysis work milestones", async () => {
    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/song-analysis-works/4")

    expect(await screen.findByRole("heading", { name: "Work #4" })).toBeInTheDocument()
    expect(screen.getByText("Elapsed time")).toBeInTheDocument()
    expect(screen.getByText("Created to terminal")).toBeInTheDocument()
    expect(screen.getAllByText("3m 00s").length).toBeGreaterThan(0)
  })

  test("shows stage failures, stage output, and resumes from the failed stage", async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch()
    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/song-analysis-works/5")

    expect(await screen.findByRole("heading", { name: "Work #5" })).toBeInTheDocument()
    expect(screen.getByText("IllegalStateException: bad answer")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "View (80 chars)" }))
    expect(await screen.findByText(/고양이/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /resume from ANALYZE_LYRICS/i }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/song-analysis-works/5/resume"), expect.objectContaining({ method: "POST" })),
    )
    expect(await screen.findByText("PENDING")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /resume from/i })).not.toBeInTheDocument()
  })

  test("renders reels factory and enables render after line selection", async () => {
    const user = userEvent.setup()
    sessionStorage.setItem("kotonoha.admin.token", "admin-token")
    renderApp("/reels-factory")

    expect(await screen.findByRole("heading", { name: "Reels Factory" })).toBeInTheDocument()
    expect(await screen.findByText("歌詞0")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Render and download MP4/ })).toBeDisabled()

    // 줄 목록이 첫 번째. 인스펙터·타임라인에도 같은 가사가 뜬다.
    const row = (index: number) => screen.getAllByText(`歌詞${index}`)[0]
    // 첫 줄에서 눌러 마지막 줄까지 끌면 범위가 한 번에 들어간다
    await user.pointer([{ keys: "[MouseLeft>]", target: row(0) }, { target: row(1) }, { target: row(3) }, { keys: "[/MouseLeft]" }])
    for (const index of [0, 1, 2, 3]) {
      expect(screen.getByLabelText(`Select lyric line ${index}`)).toHaveAttribute("aria-pressed", "true")
    }
    // 타임스탬프에서 클립 구간이 잡히고 마지막 줄은 인스펙터에 뜬다
    expect(screen.getByLabelText("Clip start")).toHaveValue("0:00.0")
    expect(screen.getByLabelText("Line 3 start")).toHaveValue("0:06.0")
    // 추천 단어는 기본 선택, 조동사는 고를 수 없고, 다른 동사는 눌러서 넣는다
    expect(screen.getByLabelText("Toggle word 沈む")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getAllByLabelText("Toggle word ように")[0]).toBeDisabled()
    await user.click(screen.getByLabelText("Toggle word 溶けてゆく"))
    expect(screen.getByLabelText("Toggle word 溶けてゆく")).toHaveAttribute("aria-pressed", "true")

    expect(screen.getByRole("button", { name: /Render and download MP4/ })).toBeEnabled()

    // 뜻은 분석 결과가 기본이고 어드민이 그 자리에서 고쳐 쓴다. 되돌리기는 분석 결과로 돌아간다.
    expect(screen.getByLabelText("Meaning for 沈む")).toHaveValue("가라앉다")
    await user.clear(screen.getByLabelText("Meaning for 沈む"))
    await user.type(screen.getByLabelText("Meaning for 沈む"), "잠기다")
    expect(screen.getByLabelText("Toggle word 沈む")).toHaveTextContent("잠기다")
    await user.click(screen.getByLabelText("Reset meaning for 沈む"))
    expect(screen.getByLabelText("Meaning for 沈む")).toHaveValue("가라앉다")
    // 조동사·조사는 릴스에서 뜻이 비므로 고쳐 쓸 칸도 없다
    expect(screen.queryByLabelText("Meaning for ように")).toBeNull()

    // 일본어 글자 크기는 릴스 전체에 고정이고 기본 크기로 되돌릴 수 있다
    expect(screen.getByLabelText("Lyric size")).toHaveValue("1")
    expect(screen.getByRole("button", { name: "기본 크기" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Lyric size"), { target: { value: "1.2" } })
    expect(screen.getByLabelText("Lyric size")).toHaveValue("1.2")
    await user.click(screen.getByRole("button", { name: "기본 크기" }))
    expect(screen.getByLabelText("Lyric size")).toHaveValue("1")
    expect(screen.getByLabelText("Toggle word 沈む")).toHaveTextContent("가라앉다")

    // 곡 제목·아티스트는 DB 값으로 채워지고 어드민이 고쳐 쓴다. 비우면 렌더할 수 없다.
    expect(screen.getByLabelText("Song title")).toHaveValue(reelsSongCandidate.title)
    expect(screen.getByLabelText("Song artist")).toHaveValue(reelsSongCandidate.artist)
    await user.clear(screen.getByLabelText("Song title"))
    expect(screen.getByText("곡 제목을 입력해야 합니다")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Render and download MP4/ })).toBeDisabled()
    await user.type(screen.getByLabelText("Song title"), "레몬")
    expect(screen.getByRole("button", { name: /Render and download MP4/ })).toBeEnabled()

    // 헤드라인도 서버 기본값으로 채워지고 어드민이 고쳐 쓴다. <b> 로 감싼 자리에 초록 배경이 깔린다.
    expect(screen.getByLabelText("Headline")).toHaveValue(reelsSongDetail.headline)
    await user.clear(screen.getByLabelText("Headline"))
    expect(screen.getByText("헤드라인을 입력해야 합니다")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Render and download MP4/ })).toBeDisabled()
    await user.type(screen.getByLabelText("Headline"), "가사 한 줄에 <b>단어 6개</b>")
    expect(screen.getByRole("button", { name: /Render and download MP4/ })).toBeEnabled()

    // 든 줄에서 끌기 시작하면 빼기, 체크 한 번은 그 줄만 토글, Shift+클릭은 마지막 줄부터 범위
    await user.pointer([{ keys: "[MouseLeft>]", target: row(2) }, { target: row(3) }, { keys: "[/MouseLeft]" }])
    expect(screen.getByLabelText("Select lyric line 2")).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByLabelText("Select lyric line 3")).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByLabelText("Select lyric line 1")).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByLabelText("Select lyric line 1"))
    expect(screen.getByLabelText("Select lyric line 1")).toHaveAttribute("aria-pressed", "false")
    await user.keyboard("{Shift>}")
    await user.click(row(3))
    await user.keyboard("{/Shift}")
    for (const index of [1, 2, 3]) {
      expect(screen.getByLabelText(`Select lyric line ${index}`)).toHaveAttribute("aria-pressed", "true")
    }
    await user.click(screen.getByLabelText("Clear selected lines"))
    expect(screen.getByRole("button", { name: /Render and download MP4/ })).toBeDisabled()
  })
})
