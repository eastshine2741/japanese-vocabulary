import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// jsdom 은 <video> 재생을 구현하지 않아 "Not implemented" 를 찍는다. 릴스 모니터가 마운트될 때 조용히 넘어가게 한다.
Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() })
Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: vi.fn(() => Promise.resolve()) })

afterEach(() => cleanup())
