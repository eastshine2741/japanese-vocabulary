import { describe, expect, test } from "vitest"
import { isoToKstInput, kstInputToIso } from "@/pages/feature-flags/FeatureFlagsPage"

describe("feature flag KST input", () => {
  test("round-trips KST datetime-local through UTC ISO", () => {
    expect(kstInputToIso("2026-10-20T09:00")).toBe("2026-10-20T00:00:00.000Z")
    expect(isoToKstInput("2026-10-20T00:00:00Z")).toBe("2026-10-20T09:00")
  })

  test("empty means no bound", () => {
    expect(kstInputToIso("")).toBeNull()
    expect(isoToKstInput(null)).toBe("")
  })
})
