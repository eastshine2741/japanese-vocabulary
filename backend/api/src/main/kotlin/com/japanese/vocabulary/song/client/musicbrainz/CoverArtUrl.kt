package com.japanese.vocabulary.song.client.musicbrainz

/**
 * Cover Art Archive URL helpers.
 *
 * CAA serves redirects (HTTP 307) to image hosts. Sizes: 250 / 500 / 1200 / original.
 * If the release has no art uploaded, the URL returns 404 — the frontend renders a placeholder.
 */
object CoverArtUrl {
    private const val BASE = "https://coverartarchive.org"

    fun releaseFront(releaseMbid: String, size: Int = 500): String =
        "$BASE/release/$releaseMbid/front-$size"
}
