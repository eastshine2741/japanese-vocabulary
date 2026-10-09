package com.japanese.vocabulary.song.service

import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory

class MvSearchDefectReporterTest {

    private val objectMapper = ObjectMapper().registerKotlinModule()
    private val reporter = MvSearchDefectReporter(objectMapper)

    @Test
    fun `a long candidate list is cut to parseable JSON, title mismatches first`() {
        val ranked = MvSearchCandidate("search", "ranked-id", "曲".repeat(300), "チャンネル".repeat(40), durationSeconds = 240, score = -10)
        val mismatches = (1..60).map {
            MvSearchCandidate.rejected("uploads", "mismatch-$it", "別の曲".repeat(40), "チャンネル".repeat(40), "title-mismatch")
        }

        val json = capture { reporter.report(1L, "曲", "歌手", 240, MvSearchResult(null, mismatches + ranked)) }
            .removePrefix("MV_SEARCH_DEFECT ")

        assertThat(json.length).isLessThanOrEqualTo(7_000)
        val candidates = objectMapper.readTree(json)["candidates"]
        assertThat(candidates.first()["videoId"].asText()).isEqualTo("ranked-id")
        assertThat(candidates.first()["title"].asText()).hasSize(100)
        assertThat(candidates.first().has("live")).isFalse()
    }

    private fun capture(block: () -> Unit): String {
        val appender = ListAppender<ILoggingEvent>().also { it.start() }
        val logger = LoggerFactory.getLogger(MvSearchDefectReporter::class.java) as Logger
        logger.addAppender(appender)
        try {
            block()
        } finally {
            logger.detachAppender(appender)
        }
        return appender.list.single().formattedMessage
    }
}
