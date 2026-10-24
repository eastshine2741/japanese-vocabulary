/** 앱과 같은 규칙: 이미 시작한 줄 중 마지막 줄. 시각이 없는 줄은 건너뛴다. */
export function lineAt(times: (number | null)[], ms: number): number {
  let current = -1
  times.forEach((time, index) => {
    if (time != null && time <= ms) current = index
  })
  return current
}

export function formatClock(ms: number | null): string {
  if (ms == null) return "-"
  const seconds = ms / 1000
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`
}

export function formatDelta(synced: number | null, original: number | null): string {
  if (synced == null || original == null) return "-"
  const delta = (synced - original) / 1000
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}s`
}
