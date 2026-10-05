package com.japanese.vocabulary.translation.service.pipeline

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.translation.model.AnalysisDefect
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Writes each [AnalysisDefect] as one `ANALYSIS_DEFECT {json}` warning.
 *
 * The message template is constant so Sentry folds defects into a single issue; per-defect content
 * lives in the event message.
 */
@Component
class AnalysisDefectReporter(
    private val objectMapper: ObjectMapper,
) {
    private val logger = LoggerFactory.getLogger(AnalysisDefectReporter::class.java)

    fun report(defect: AnalysisDefect) {
        logger.warn("$MARKER {}", objectMapper.writeValueAsString(defect))
    }

    fun reportAll(defects: Iterable<AnalysisDefect>) = defects.forEach(::report)

    companion object {
        const val MARKER = "ANALYSIS_DEFECT"
    }
}
