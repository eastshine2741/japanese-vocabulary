export function syncStatusTone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "COMPLETED") return "success"
  if (status === "FAILED") return "danger"
  if (status === "RUNNING") return "warning"
  return "neutral"
}

export function verdictTone(verdict: string): "success" | "warning" {
  return verdict === "OK" ? "success" : "warning"
}
