import { describe, expect, test } from "vitest"
import { formatClock, formatDelta, lineAt } from "./lineAt"

describe("lineAt", () => {
  test("picks the last line already started and skips lines without a time", () => {
    const times = [1000, null, 3000, 3000, 9000]
    expect(lineAt(times, 500)).toBe(-1)
    expect(lineAt(times, 2000)).toBe(0)
    // 시작 시각이 같은 두 줄은 앞 줄이 화면에 머물 틈이 없다(あだぽしゃ 버그가 이렇게 보였다).
    expect(lineAt(times, 3000)).toBe(3)
    expect(lineAt(times, 10000)).toBe(4)
  })
})

describe("formatting", () => {
  test("clock and offset", () => {
    expect(formatClock(70240)).toBe("1:10.24")
    expect(formatClock(null)).toBe("-")
    expect(formatDelta(70240, 18440)).toBe("+51.80s")
    expect(formatDelta(1000, 1330)).toBe("-0.33s")
    expect(formatDelta(1000, null)).toBe("-")
  })
})
