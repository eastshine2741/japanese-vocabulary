import { describe, expect, it } from "vitest"
import type { LyricToken } from "@/api/types"
import { buildLineReading } from "./lineReading"

/** A token as the analysis stores it: position in the raw line plus the reading sung there. */
const token = (
  surface: string,
  reading: string | null,
  charStart: number,
  partOfSpeech = "NOUN",
): LyricToken => ({
  surface,
  baseForm: surface,
  reading,
  baseFormReading: reading,
  partOfSpeech,
  charStart,
  charEnd: charStart + surface.length,
})

describe("buildLineReading", () => {
  it("assembles the tokens in position order", () => {
    expect(buildLineReading("東京の夜", [token("東京", "トウキョウ", 0),
      token("の", "ノ", 2, "PARTICLE"), token("夜", "ヨル", 3)])).toBe("トウキョウノ ヨル")
  })

  it("separates words, since Japanese writes no spaces", () => {
    expect(buildLineReading("夕暮れは悲しい", [token("夕暮れ", "ユウグレ", 0),
      token("は", "ワ", 3, "PARTICLE"), token("悲しい", "カナシイ", 4)]))
      .toBe("ユウグレワ カナシイ")
  })

  it("keeps an all-hiragana token attached to the word it inflects", () => {
    expect(buildLineReading("揺らせば", [token("揺ら", "ユラ", 0), token("せば", "セバ", 2, "VERB")]))
      .toBe("ユラセバ")
  })

  it("keeps a 촉음 with the token in front of it", () => {
    expect(buildLineReading("散々だって", [token("散々", "サンザン", 0), token("だ", "ダ", 2),
      token("って", "ッテ", 3, "PARTICLE")])).toBe("サンザンダッテ")
  })

  it("copies punctuation and latin runs between tokens", () => {
    expect(buildLineReading("「ネコ」 yay", [token("ネコ", "ネコ", 1)])).toBe("「ネコ」 yay")
  })

  it("reads a word break where Japanese was left uncovered", () => {
    expect(buildLineReading("叫べべベノム", [token("叫べ", "サケベ", 0), token("ベノム", "ベノム", 3)]))
      .toBe("サケベ ベノム")
  })

  it("has nothing to assemble without tokens", () => {
    expect(buildLineReading("la la la", [])).toBe("")
  })

  it("falls back to the surface of a token with no reading", () => {
    expect(buildLineReading("Oh 恋", [token("Oh", null, 0), token("恋", "コイ", 3)])).toBe("Oh コイ")
  })
})
