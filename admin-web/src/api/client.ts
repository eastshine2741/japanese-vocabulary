import type {
  AdminUser,
  LoginResponse,
  LyricDetail,
  PageResponse,
  Recommendation,
  RecommendationCandidate,
  RecommendationOperationResult,
  ReelsRenderRequest,
  ReelsSongCandidate,
  ReelsSongDetail,
  ReelsSource,
  SongAnalysisWorkDetail,
  SongAnalysisWorkSummary,
  SongAnalysisWorkOperation,
  SongDetail,
  SongSummary,
} from "@/api/types"

const API_BASE = import.meta.env.VITE_ADMIN_API_BASE_URL ?? "http://localhost:8081/admin/api"

/** `<video src>` 처럼 fetch 를 거치지 않는 곳에서 API 상대 경로를 절대 URL 로 만든다. */
export function apiUrl(path: string) {
  return `${API_BASE}${path}`
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown = null,
  ) {
    super(message)
  }
}

async function request<T>(path: string, token?: string | null, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set("Accept", "application/json")
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  if (token) headers.set("Authorization", `Bearer ${token}`)

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    throw await apiError(response)
  }
  return response.json() as Promise<T>
}

async function requestBlob(path: string, token: string, init: RequestInit): Promise<Blob> {
  const headers = new Headers(init.headers)
  headers.set("Accept", "video/mp4, application/json")
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  headers.set("Authorization", `Bearer ${token}`)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!response.ok) {
    throw await apiError(response)
  }
  return response.blob()
}

async function apiError(response: Response) {
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }
  return new ApiError(errorMessage(data, response.statusText), response.status, data)
}

function errorMessage(data: unknown, fallback: string | number) {
  const body = data as { message?: string; error?: string } | null
  return body?.message || body?.error || String(fallback) || "Request failed"
}

function pageParams(page: number, query?: string) {
  const params = new URLSearchParams({ page: String(page), size: "20" })
  if (query?.trim()) params.set("q", query.trim())
  return params
}

export const adminApi = {
  login(password: string) {
    return request<LoginResponse>("/auth/login", null, {
      method: "POST",
      body: JSON.stringify({ password }),
    })
  },
  songs(token: string, page: number, query?: string) {
    return request<PageResponse<SongSummary>>(`/songs?${pageParams(page, query)}`, token)
  },
  song(token: string, id: string) {
    return request<SongDetail>(`/songs/${id}`, token)
  },
  triggerSongReanalysis(token: string, id: string) {
    return request<SongAnalysisWorkSummary>(`/songs/${id}/reanalysis`, token, {
      method: "POST",
    })
  },
  songLyric(token: string, id: string) {
    return request<LyricDetail>(`/songs/${id}/lyric`, token)
  },
  lyric(token: string, id: string) {
    return request<LyricDetail>(`/lyrics/${id}`, token)
  },
  songAnalysisWorks(token: string, page: number, status?: string) {
    const params = new URLSearchParams({ page: String(page), size: "20" })
    if (status) params.set("status", status)
    return request<PageResponse<SongAnalysisWorkSummary>>(`/song-analysis-works?${params}`, token)
  },
  songAnalysisWork(token: string, id: string) {
    return request<SongAnalysisWorkDetail>(`/song-analysis-works/${id}`, token)
  },
  recommendationWeeks(token: string) {
    return request<string[]>("/recommendations/weeks", token)
  },
  recommendationCandidates(token: string, weekStartDate?: string, status?: string) {
    const params = new URLSearchParams()
    if (weekStartDate) params.set("weekStartDate", weekStartDate)
    if (status) params.set("status", status)
    const query = params.toString()
    return request<RecommendationCandidate[]>(`/recommendations/candidates${query ? `?${query}` : ""}`, token)
  },
  updateRecommendationCandidateStatus(token: string, candidateId: number, status: string) {
    return request<RecommendationCandidate>(`/recommendations/candidates/${candidateId}/status`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    })
  },
  recommendations(token: string, weekStartDate?: string) {
    const params = new URLSearchParams()
    if (weekStartDate) params.set("weekStartDate", weekStartDate)
    const query = params.toString()
    return request<Recommendation[]>(`/recommendations${query ? `?${query}` : ""}`, token)
  },
  updateRecommendation(token: string, recommendationId: number, payload: { status?: string; orderIndex?: number }) {
    return request<Recommendation>(`/recommendations/${recommendationId}`, token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  },
  prepareApprovedRecommendations(token: string, weekStartDate?: string) {
    const params = new URLSearchParams()
    if (weekStartDate) params.set("weekStartDate", weekStartDate)
    const query = params.toString()
    return request<RecommendationOperationResult>(
      `/recommendations/prepare-approved${query ? `?${query}` : ""}`,
      token,
      { method: "POST" },
    )
  },
  requestRecommendationAnalysis(token: string, candidateIds: number[]) {
    return request<RecommendationOperationResult>("/recommendations/request-analysis", token, {
      method: "POST",
      body: JSON.stringify({ candidateIds }),
    })
  },
  users(token: string, page: number, query?: string) {
    return request<PageResponse<AdminUser>>(`/users?${pageParams(page, query)}`, token)
  },
  user(token: string, id: string) {
    return request<AdminUser>(`/users/${id}`, token)
  },
  reelsSongs(token: string, page: number, query?: string) {
    return request<PageResponse<ReelsSongCandidate>>(`/reels-factory/songs?${pageParams(page, query)}`, token)
  },
  reelsSong(token: string, id: number) {
    return request<ReelsSongDetail>(`/reels-factory/songs/${id}`, token)
  },
  /** 이전에 올린 MV 가 서버 캐시에 남아 있으면 스트리밍 경로를 받는다. 없으면 null. */
  async reelsCachedSource(token: string, songId: number) {
    try {
      return await request<ReelsSource>(`/reels-factory/songs/${songId}/source`, token)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) return null
      throw cause
    }
  },
  /** 어드민이 직접 받은 MV mp4 를 올린다. 수백 MB 라 진행률을 보여 주려고 fetch 대신 XHR 을 쓴다. */
  reelsUploadSource(token: string, songId: number, file: File, onProgress: (ratio: number) => void) {
    return new Promise<ReelsSource>((resolve, reject) => {
      const body = new FormData()
      body.append("file", file, file.name)
      const xhr = new XMLHttpRequest()
      xhr.open("POST", `${API_BASE}/reels-factory/songs/${songId}/source`)
      xhr.setRequestHeader("Accept", "application/json")
      xhr.setRequestHeader("Authorization", `Bearer ${token}`)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total)
      }
      xhr.onerror = () => reject(new ApiError("Network error", 0))
      xhr.onload = () => {
        let data: unknown = null
        try {
          data = JSON.parse(xhr.responseText)
        } catch {
          data = null
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data as ReelsSource)
        else reject(new ApiError(errorMessage(data, xhr.status), xhr.status, data))
      }
      xhr.send(body)
    })
  },
  renderReel(token: string, body: ReelsRenderRequest) {
    return requestBlob("/reels-factory/render", token, {
      method: "POST",
      body: JSON.stringify(body),
    })
  },
}
