package com.japanese.vocabulary.observability

import com.japanese.vocabulary.observability.HttpClientMetricsConfig.Companion.classify
import com.japanese.vocabulary.observability.HttpClientMetricsConfig.Companion.groupOf
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import java.net.URI

class HttpClientMetricsConfigTest {

    @ParameterizedTest
    @CsvSource(
        "https://generativelanguage.googleapis.com/v1beta/models/x:generateContent, gemini, llm",
        "https://api.typesafe.ai/v1/systemone, jev, llm",
        "https://jisho.org/api/v1/search/words, jisho, dictionary",
        "https://lrclib.net/api/search, lrclib, lyrics",
        "https://api.music.apple.com/v1/catalog/jp/songs, apple-music, music-meta",
        "https://vocadb.net/api/songs, vocadb, music-meta",
        "https://utaitedb.net/api/songs, utaitedb, music-meta",
        "https://www.googleapis.com/youtube/v3/search, youtube, video",
        "https://api.github.com/repos/o/r/issues, github, ops",
        "https://www.googleapis.com/oauth2/v3/certs, other, other",
        "https://example.com/, other, other",
    )
    fun `classifies the destination and its group`(url: String, api: String, group: String) {
        assertThat(classify(URI(url))).isEqualTo(api)
        assertThat(groupOf(api)).isEqualTo(group)
    }

    @Test
    fun `a request without a uri is other`() {
        assertThat(classify(null)).isEqualTo("other")
    }
}
