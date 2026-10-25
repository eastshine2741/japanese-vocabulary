package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricMvSyncEntity
import com.japanese.vocabulary.song.entity.LyricMvSyncMethod
import com.japanese.vocabulary.song.entity.LyricMvSyncStatus
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.LyricLineTiming
import com.japanese.vocabulary.song.model.YoutubeVideoId
import com.japanese.vocabulary.song.repository.LyricMvSyncRepository
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Duration
import java.time.Instant

data class LyricMvSyncClaim(
    val id: Long,
    val attempt: Int,
    val songId: Long,
    val title: String,
    val artist: String,
    val durationSeconds: Int?,
    val lyricId: Long,
    val lyricType: LyricType,
    val youtubeVideoId: String,
    val lines: List<LyricLineData>,
)

/** 줄 시각을 곡의 지금 MV 에 맞추는 작업 원장. 계산은 로컬 PC 실행기가 admin-api 로 점유해서 한다. */
@Service
class LyricMvSyncService(
    private val syncRepository: LyricMvSyncRepository,
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
    private val clock: Clock,
) {
    /** 곡의 지금 (active 가사, MV) 조합을 대기열에 넣는다. 이미 있으면 그대로 둔다. */
    @Transactional
    fun enqueue(song: SongEntity) {
        val lyricId = song.activeLyricId ?: return
        val videoId = YoutubeVideoId.parse(song.youtubeUrl) ?: return
        syncRepository.enqueue(lyricId, videoId)
    }

    @Transactional
    fun enqueueMissing(): Int = syncRepository.enqueueMissingForSongs()

    @Transactional
    fun claim(): LyricMvSyncClaim? {
        val now = Instant.now(clock)
        while (true) {
            val id = syncRepository.findNextClaimableIdForUpdate(now) ?: return null
            // 잠금 읽기여야 한다. 일반 읽기는 이 트랜잭션의 첫 스냅샷을 봐서 그 뒤에 커밋된 행을 못 찾는다.
            val row = syncRepository.findByIdForUpdate(id) ?: return null
            val target = currentTarget(row)
            if (target == null) {
                // 기다리는 사이 MV 나 active 가사가 바뀌었다. 바뀐 조합은 그쪽에서 따로 넣는다.
                row.status = LyricMvSyncStatus.FAILED
                row.errorMessage = SUPERSEDED
                row.leaseUntil = null
                continue
            }
            row.status = LyricMvSyncStatus.RUNNING
            row.attempt += 1
            row.leaseUntil = now.plus(LEASE)
            val (song, lyric) = target
            return LyricMvSyncClaim(
                id = id,
                attempt = row.attempt,
                songId = song.id!!,
                title = song.title,
                artist = song.artist,
                durationSeconds = song.durationSeconds,
                lyricId = lyric.id!!,
                lyricType = lyric.lyricType,
                youtubeVideoId = row.youtubeVideoId,
                lines = lyric.rawContent.sortedBy { it.index },
            )
        }
    }

    @Transactional
    fun complete(
        id: Long,
        attempt: Int,
        method: LyricMvSyncMethod,
        timings: List<LyricLineTiming>,
        confidence: Map<String, Any?>?,
    ) {
        val row = lockRunning(id, attempt)
        val lyric = lyricRepository.findById(row.lyricId).orElseThrow { BusinessException(ErrorCode.LYRIC_NOT_FOUND) }
        if (!coversEveryLine(timings, lyric) || !playable(timings)) throw BusinessException(ErrorCode.LYRIC_MV_SYNC_INVALID_RESULT)
        row.status = LyricMvSyncStatus.COMPLETED
        row.method = method
        row.lineTimings = timings.sortedBy { it.index }
        row.confidence = confidence
        row.errorMessage = null
        row.leaseUntil = null
        row.completedAt = Instant.now(clock)
    }

    /**
     * [retryable] 은 실행기 쪽 사정(다운로드 차단, GPU 오류)으로 못 한 경우다. 바로 다시 점유하면 같은 오류로 대기열 전체를
     * 태우므로 [RETRY_DELAY] 뒤로 미루고, [MAX_ATTEMPTS] 번째에는 FAILED 로 둔다.
     */
    @Transactional
    fun fail(id: Long, attempt: Int, message: String, retryable: Boolean) {
        val row = lockRunning(id, attempt)
        row.errorMessage = message.take(MAX_ERROR_LENGTH)
        if (retryable && row.attempt < MAX_ATTEMPTS) {
            row.status = LyricMvSyncStatus.PENDING
            row.leaseUntil = Instant.now(clock).plus(RETRY_DELAY)
        } else {
            row.status = LyricMvSyncStatus.FAILED
            row.leaseUntil = null
        }
    }

    /** 곡의 지금 MV 에 맞춘 줄 시각. 없거나 LOW 면 null 이고 호출자는 가사 원래 시각을 쓴다. */
    @Transactional(readOnly = true)
    fun timingsFor(song: SongEntity, lyric: LyricEntity): Map<Int, Long?>? {
        val videoId = YoutubeVideoId.parse(song.youtubeUrl) ?: return null
        val row = syncRepository.findByLyricIdAndYoutubeVideoIdAndStatus(lyric.id!!, videoId, LyricMvSyncStatus.COMPLETED)
            ?: return null
        if (isLow(row)) return null
        val timings = row.lineTimings ?: return null
        if (!coversEveryLine(timings, lyric)) return null
        return timings.associate { it.index to it.startTimeMs }
    }

    private fun lockRunning(id: Long, attempt: Int): LyricMvSyncEntity {
        val row = syncRepository.findByIdForUpdate(id) ?: throw BusinessException(ErrorCode.LYRIC_MV_SYNC_NOT_FOUND)
        // 기한이 지나 다시 점유됐거나 이미 끝난 행에 늦게 온 결과다.
        if (row.status != LyricMvSyncStatus.RUNNING || row.attempt != attempt) {
            throw BusinessException(ErrorCode.LYRIC_MV_SYNC_SUPERSEDED)
        }
        return row
    }

    private fun currentTarget(row: LyricMvSyncEntity): Pair<SongEntity, LyricEntity>? {
        val lyric = lyricRepository.findById(row.lyricId).orElse(null) ?: return null
        val song = songRepository.findById(lyric.songId).orElse(null) ?: return null
        if (song.activeLyricId != lyric.id || YoutubeVideoId.parse(song.youtubeUrl) != row.youtubeVideoId) return null
        return song to lyric
    }

    private fun coversEveryLine(timings: List<LyricLineTiming>, lyric: LyricEntity): Boolean {
        val indexes = timings.map { it.index }
        return indexes.size == indexes.toSet().size && indexes.toSet() == lyric.rawContent.map { it.index }.toSet()
    }

    /** 앱은 시각이 줄 순서대로 늘어난다고 보고 현재 줄을 찾는다. 거꾸로 가면 하이라이트가 엉뚱한 줄에 멈춘다. */
    private fun playable(timings: List<LyricLineTiming>): Boolean {
        val times = timings.sortedBy { it.index }.mapNotNull { it.startTimeMs }
        return times.isNotEmpty() && times.first() >= 0 && times.zipWithNext().all { (a, b) -> a <= b }
    }

    companion object {
        /** 곡 하나가 GPU 로 2분 남짓이다. 오디오 받기가 느려도 넉넉하게 잡는다. */
        val LEASE: Duration = Duration.ofMinutes(30)
        val RETRY_DELAY: Duration = Duration.ofHours(1)
        const val MAX_ATTEMPTS = 5
        private const val MAX_ERROR_LENGTH = 1000
        const val SUPERSEDED = "superseded: song MV or active lyric changed"

        /**
         * 실행기가 MV 에서 줄을 충분히 못 찾았거나 찾은 줄끼리 시각이 안 맞은 결과다. 틀린 줄을 짚는 하이라이트보다
         * 원래 시각(PLAIN 이면 자동 싱크 없음)이 낫다. 행은 남겨 어드민에서 들어 보고 고친다.
         */
        fun isLow(row: LyricMvSyncEntity): Boolean = row.confidence?.get("verdict") == "LOW"
    }
}
