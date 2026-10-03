package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.batch.CronTask
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.stereotype.Component

/**
 * 정기 실행이 아니라 손으로 돌리는 백필. CronJob 이 아니라
 * `kubectl create job --from=cronjob/... -- --task=lyric-word-candidate-backfill` 로 부른다.
 *
 * `--regenerate=true` 는 이미 candidate 가 있는 가사도 지금 generator 로 다시 찍는다.
 */
@Component
class LyricWordCandidateBackfillTask(
    private val backfillService: LyricWordCandidateBackfillService,
) : CronTask {
    private val logger = LoggerFactory.getLogger(LyricWordCandidateBackfillTask::class.java)

    override val name = NAME

    override fun run(args: ApplicationArguments) {
        val result = backfillService.backfill(
            songId = args.optional("songId")?.toLong(),
            limit = args.optional("limit")?.toInt() ?: DEFAULT_LIMIT,
            dryRun = args.optional("dryRun").toBoolean(),
            regenerate = args.optional("regenerate").toBoolean(),
        )
        logger.info("lyricWordCandidateBackfill result={}", result)
    }

    private fun ApplicationArguments.optional(name: String): String? =
        getOptionValues(name)?.firstOrNull()?.takeIf { it.isNotBlank() }

    companion object {
        const val NAME = "lyric-word-candidate-backfill"
        const val DEFAULT_LIMIT = 100
    }
}
