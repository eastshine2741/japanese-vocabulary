package com.japanese.vocabulary.song.batch

import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * One-off internal backfill for lyrics that already have analyzed tokens but are missing
 * word_candidates_json. The batch service has no public ingress; call from inside the cluster.
 */
@RestController
@RequestMapping("/api/dev/song-word-candidates")
class SongWordCandidateBackfillDevController(
    private val backfillService: SongWordCandidateBackfillService,
) {
    @PostMapping("/backfill")
    fun backfill(
        @RequestParam(required = false) songId: Long?,
        @RequestParam(defaultValue = "100") limit: Int,
        @RequestParam(defaultValue = "false") dryRun: Boolean,
    ): SongWordCandidateBackfillService.Result =
        backfillService.backfill(songId = songId, limit = limit, dryRun = dryRun)
}
