import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function formatNumber(value?: number | null) {
  return value == null ? "-" : new Intl.NumberFormat().format(value)
}

export function formatDurationMillis(value?: number | null) {
  if (value == null) return "-"
  if (value < 1000) return `${value}ms`

  const totalSeconds = Math.round(value / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`
}

const DAY_MILLIS = 24 * 60 * 60 * 1000

/** 오늘·어제·N일 전 처럼 짧은 상대 시각. 미래(다음 복습 예정)는 N일 후. */
export function formatRelativeDays(value?: string | null, now: number = Date.now()) {
  if (!value) return "-"
  const days = Math.floor((now - new Date(value).getTime()) / DAY_MILLIS)
  if (days < 0) {
    const ahead = -days
    if (ahead < 30) return `${ahead}일 후`
    if (ahead < 365) return `${Math.floor(ahead / 30)}개월 후`
    return `${Math.floor(ahead / 365)}년 후`
  }
  if (days === 0) return "오늘"
  if (days === 1) return "어제"
  if (days < 30) return `${days}일 전`
  if (days < 365) return `${Math.floor(days / 30)}개월 전`
  return `${Math.floor(days / 365)}년 전`
}

/** 마지막 활동이 얼마나 오래됐는지에 따른 강조 톤. 7일·30일 경계는 앱의 주간 스트릭·월간 통계 기준을 따른다. */
export function recencyTone(value?: string | null, now: number = Date.now()): "muted" | "success" | "warning" | "danger" {
  if (!value) return "muted"
  const days = (now - new Date(value).getTime()) / DAY_MILLIS
  if (days <= 7) return "success"
  if (days <= 30) return "warning"
  return "danger"
}
