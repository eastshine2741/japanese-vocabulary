import type {
  AdminUser,
  LoginResponse,
  LyricDetail,
  LyricSummary,
  PageResponse,
  SongDetail,
  SongSummary,
} from "@/api/types"

const API_BASE = import.meta.env.VITE_ADMIN_API_BASE_URL ?? "http://localhost:8081/admin/api"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
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
    throw new ApiError(response.statusText || "Request failed", response.status)
  }
  return response.json() as Promise<T>
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
  lyrics(token: string, page: number, status?: string) {
    const params = new URLSearchParams({ page: String(page), size: "20" })
    if (status) params.set("status", status)
    return request<PageResponse<LyricSummary>>(`/lyrics?${params}`, token)
  },
  lyric(token: string, id: string) {
    return request<LyricDetail>(`/lyrics/${id}`, token)
  },
  users(token: string, page: number, query?: string) {
    return request<PageResponse<AdminUser>>(`/users?${pageParams(page, query)}`, token)
  },
  user(token: string, id: string) {
    return request<AdminUser>(`/users/${id}`, token)
  },
}
