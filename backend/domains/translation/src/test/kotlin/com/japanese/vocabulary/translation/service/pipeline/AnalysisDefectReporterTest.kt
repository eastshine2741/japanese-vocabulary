package com.japanese.vocabulary.translation.service.pipeline

import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.japanese.vocabulary.translation.model.AnalysisDefect
import com.japanese.vocabulary.translation.model.AnalysisDefectCause
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory

/**
 * The log line is a contract: `.github/scripts/analysis-feedback/run.sh` finds it by
 * [AnalysisDefectReporter.MARKER] and reads the JSON after it. A change here is a change there.
 */
class AnalysisDefectReporterTest {

    private val objectMapper = ObjectMapper().registerKotlinModule()
    private val reporter = AnalysisDefectReporter(objectMapper)
    private val logger = LoggerFactory.getLogger(AnalysisDefectReporter::class.java) as Logger
    private val appender = ListAppender<ILoggingEvent>()

    @BeforeEach
    fun attach() {
        appender.start()
        logger.addAppender(appender)
    }

    @AfterEach
    fun detach() {
        logger.detachAppender(appender)
    }

    @Test
    fun `writes one warning per defect with the marker and a JSON body the runner can read back`() {
        val defect = AnalysisDefect(
            songId = 70,
            lyricId = 71,
            lineIndex = 3,
            cause = AnalysisDefectCause.DICTIONARY_MISS,
            surface = "買えれ",
            headword = "買える",
            line = "金で買えれば 何でも",
        )

        reporter.report(defect)

        val event = appender.list.single()
        assertThat(event.level.levelStr).isEqualTo("WARN")
        // The template stays constant so Sentry keeps every defect under one issue.
        assertThat(event.message).isEqualTo("ANALYSIS_DEFECT {}")
        val json = event.formattedMessage.removePrefix("ANALYSIS_DEFECT ")
        assertThat(objectMapper.readValue<AnalysisDefect>(json)).isEqualTo(defect)
    }
}
