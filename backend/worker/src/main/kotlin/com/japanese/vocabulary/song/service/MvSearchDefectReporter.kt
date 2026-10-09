package com.japanese.vocabulary.song.service

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Logs a song that finished without an MV as one `MV_SEARCH_DEFECT {json}` warning; the runner in
 * `.github/scripts/analysis-feedback` reads exactly this shape. The template is constant so Sentry
 * folds every miss into one issue.
 */
@Component
class MvSearchDefectReporter(
    private val objectMapper: ObjectMapper,
) {
    private val logger = LoggerFactory.getLogger(MvSearchDefectReporter::class.java)

    fun report(workId: Long?, title: String, artist: String, durationSeconds: Int?, result: MvSearchResult) {
        // Ranked candidates say the most; title mismatches are dropped first when over budget.
        var candidates = result.candidates
            .sortedBy { it.rejection == REJECT_TITLE_MISMATCH }
            .map { it.copy(title = it.title.take(MAX_TEXT_LENGTH), channelTitle = it.channelTitle.take(MAX_TEXT_LENGTH)) }
        var json: String
        while (true) {
            json = objectMapper.writeValueAsString(MvSearchDefect(workId, title, artist, durationSeconds, candidates))
            // Sentry cuts a message at 8KB, and the cut JSON would not parse.
            if (json.length <= MAX_JSON_LENGTH || candidates.isEmpty()) break
            candidates = candidates.dropLast(1)
        }
        logger.warn("$MARKER {}", json)
    }

    data class MvSearchDefect(
        val workId: Long?,
        val title: String,
        val artist: String,
        val durationSeconds: Int?,
        val candidates: List<MvSearchCandidate>,
    )

    companion object {
        const val MARKER = "MV_SEARCH_DEFECT"
        private const val MAX_TEXT_LENGTH = 100
        private const val MAX_JSON_LENGTH = 7_000
        private const val REJECT_TITLE_MISMATCH = "title-mismatch"
    }
}
