package com.japanese.vocabulary.song.batch

import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * One-off internal backfill for lyrics that already have analyzed tokens but are missing
 * word_candidates_json. `regenerate=true` rebuilds lyrics that already have candidates, which is how
 * existing songs pick up a changed generator (e.g. per-line appearance ordering).
 * The batch service has no public ingress; call from inside the cluster.
 */
@RestController
@RequestMapping("/api/dev/lyric-word-candidates")
class LyricWordCandidateBackfillDevController(
    private val backfillService: LyricWordCandidateBackfillService,
) {
    @PostMapping("/backfill")
    fun backfill(
        @RequestParam(required = false) songId: Long?,
        @RequestParam(defaultValue = "100") limit: Int,
        @RequestParam(defaultValue = "false") dryRun: Boolean,
        @RequestParam(defaultValue = "false") regenerate: Boolean,
    ): LyricWordCandidateBackfillService.Result =
        backfillService.backfill(songId = songId, limit = limit, dryRun = dryRun, regenerate = regenerate)
}
