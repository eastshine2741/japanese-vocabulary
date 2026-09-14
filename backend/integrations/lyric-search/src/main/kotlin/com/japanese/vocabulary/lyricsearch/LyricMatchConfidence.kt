package com.japanese.vocabulary.lyricsearch

/**
 * How much a provider's hit is backed by the artist we asked for.
 *
 * `STRONG` means the artist matched — by the provider's own filter or by our name check. `WEAK`
 * means nothing but a duration coincidence tied the hit to the query. A one-character title like
 * 『恋』 has dozens of same-titled songs on LrcLib, so a ±3s match with no artist evidence once
 * attached Conton Candy's lyrics to Sohbana's song; the caller therefore keeps a weak hit only
 * as a last resort after every other provider has been tried.
 */
enum class LyricMatchConfidence {
    STRONG,
    WEAK,
}
