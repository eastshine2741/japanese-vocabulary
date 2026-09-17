package com.japanese.vocabulary.translation.service.pipeline

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.translation.model.AnalysisDefect
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Writes each [AnalysisDefect] as one `ANALYSIS_DEFECT {json}` warning.
 *
 * The message template is constant, so Sentry folds every defect into a single issue and the
 * per-defect content lives in the event message, where an events search can read it. The old
 * per-song summary line did the opposite: seventeen songs' worth of unrelated misses shared one
 * issue, the first PR "resolved" it, and the other sixteen were never looked at.
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
