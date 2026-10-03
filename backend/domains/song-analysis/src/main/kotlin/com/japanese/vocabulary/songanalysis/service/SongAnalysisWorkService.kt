package com.japanese.vocabulary.songanalysis.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisWorkDto
import com.japanese.vocabulary.songanalysis.dto.toDto
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.event.SongAnalysisWorkQueuedEvent
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import org.springframework.context.ApplicationEventPublisher
import org.springframework.dao.ConcurrencyFailureException
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.annotation.Propagation
import org.springframework.data.domain.Pageable
import java.time.Instant

@Service
class SongAnalysisWorkService(
    private val songAnalysisWorkRepository: SongAnalysisWorkRepository,
    private val eventPublisher: ApplicationEventPublisher,
) {

    @Transactional
    fun createOrReuse(
        title: String,
        artist: String,
        durationSeconds: Int? = null,
        artworkUrl: String? = null,
        triggerSource: SongAnalysisTriggerSource = SongAnalysisTriggerSource.USER_APP,
        createdByUserId: Long? = null,
    ): SongAnalysisWorkDto {
        // 조회이면서 동시에 중복 차단이다 — 활성 행이 없으면 그 키가 들어갈 틈에 갭 락이 걸린다.
        songAnalysisWorkRepository.findActiveByRawSongForUpdate(title, artist).firstOrNull()?.let {
            return it.toDto()
        }

        val work = SongAnalysisWorkEntity(
            rawTitle = title,
            rawArtist = artist,
            durationSeconds = durationSeconds,
            artworkUrl = artworkUrl,
            triggerSource = triggerSource,
            createdByUserId = createdByUserId,
        )

        val saved = try {
            songAnalysisWorkRepository.saveAndFlush(work)
        } catch (_: ConcurrencyFailureException) {
            // 갭 락끼리는 충돌하지 않아서, 같은 곡을 동시에 요청하면 양쪽 모두 위 조회를 통과해
            // 여기까지 온다. 한쪽의 insert 는 상대 갭 락에 걸려 데드락이나 락 대기 만료로 죽는다.
            // 그때는 트랜잭션이 통째로 롤백되므로 상대가 만든 행을 다시 읽어 돌려줄 수 없다.
            // 호출자가 다시 요청하면 그 땐 위 조회가 그 행을 찾아 돌려준다.
            throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_ALREADY_EXISTS)
        }
        eventPublisher.publishEvent(SongAnalysisWorkQueuedEvent(saved.id!!))
        return saved.toDto()
    }

    /** 이 곡의 분석을 끝낸 가장 최근 작업. 이미 분석된 곡을 다시 요청받았을 때 새 작업 대신 돌려준다. */
    @Transactional(readOnly = true)
    fun findLatestCompletedForSong(songId: Long): SongAnalysisWorkDto? {
        return songAnalysisWorkRepository.findBySongIdOrderByCreatedAtDesc(songId)
            .firstOrNull { it.status == SongAnalysisWorkStatus.COMPLETED }
            ?.toDto()
    }

    @Transactional(readOnly = true)
    fun getById(id: Long): SongAnalysisWorkDto {
        return songAnalysisWorkRepository.findById(id).orElse(null)?.toDto()
            ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_FOUND)
    }

    /** Caller keeps the work lock until its subscription change has finished. */
    @Transactional(propagation = Propagation.MANDATORY)
    fun getByIdForUpdate(workId: Long): SongAnalysisWorkDto = getEntityForUpdate(workId).toDto()

    @Transactional(propagation = Propagation.MANDATORY)
    fun getLatestForLyricForUpdate(songId: Long, lyricId: Long): SongAnalysisWorkDto? {
        val id = songAnalysisWorkRepository.findLatestIdsForLyric(songId, lyricId, Pageable.ofSize(1))
            .firstOrNull() ?: return null
        return songAnalysisWorkRepository.findByIdForUpdate(id)?.toDto()
    }

    /**
     * 큐 메시지 하나가 가리키는 작업을 잡는다. 같은 메시지가 두 번 와도 PENDING 인 행만 잡히므로
     * 두 번째 배달은 null 을 받고 조용히 ack 된다. 상호배제는 이 상태 전이가 전부이고,
     * 행 잠금은 검사-후-쓰기를 원자적으로 만드는 용도다.
     */
    @Transactional
    fun claim(workId: Long): SongAnalysisWorkEntity? {
        val work = songAnalysisWorkRepository.findByIdForUpdate(workId) ?: return null
        if (work.status != SongAnalysisWorkStatus.PENDING) return null
        work.status = SongAnalysisWorkStatus.RUNNING
        work.currentStage = null
        work.clearFailure()
        return songAnalysisWorkRepository.saveAndFlush(work)
    }

    /** 메시지가 유실돼 PENDING 으로 남은 작업. sweeper 가 다시 큐에 넣는다. */
    @Transactional(readOnly = true)
    fun findStalePendingIds(olderThan: Instant, limit: Int): List<Long> =
        songAnalysisWorkRepository.findStalePendingIds(olderThan, Pageable.ofSize(limit))


    /**
     * 진행이 멈춘 RUNNING 행을 FAILED 로 넘긴다. 재시도가 아니라 포기 처리다 — 이걸 하지 않으면
     * 죽은 worker 가 남긴 행이 계속 활성으로 잡혀서 그 곡은 새 요청을 받지 못한다.
     */
    @Transactional
    fun failStaleRunning(olderThan: Instant, limit: Int): Int {
        val expired = songAnalysisWorkRepository.findStaleRunningForUpdate(
            olderThan,
            Pageable.ofSize(limit),
        )
        val now = Instant.now()
        expired.forEach { work ->
            work.markFailed(
                ErrorCode.SONG_ANALYSIS_WORK_TIMEOUT.name,
                ErrorCode.SONG_ANALYSIS_WORK_TIMEOUT.message,
                now,
            )
        }
        songAnalysisWorkRepository.saveAllAndFlush(expired)
        return expired.size
    }

    @Transactional
    fun markStage(workId: Long, stage: SongAnalysisWorkStage): Boolean {
        val work = getEntityForUpdate(workId)
        if (!work.isRunning()) return false
        work.currentStage = stage
        return true
    }

    @Transactional
    fun markPlayerReady(workId: Long, songId: Long, lyricId: Long, youtubeUrl: String?): Boolean {
        val work = getEntityForUpdate(workId)
        if (!work.isRunning()) return false
        work.attachPlayerReady(songId, lyricId, youtubeUrl, Instant.now())
        return true
    }

    @Transactional
    fun markCompleted(workId: Long): Boolean {
        val work = getEntityForUpdate(workId)
        if (!work.isRunning()) return false
        work.markCompleted(Instant.now())
        return true
    }

    @Transactional
    fun markFailed(workId: Long, code: String, message: String?): Boolean {
        val work = getEntityForUpdate(workId)
        if (!work.isRunning()) return false
        work.markFailed(code, message, Instant.now())
        return true
    }

    private fun getEntity(workId: Long): SongAnalysisWorkEntity {
        return songAnalysisWorkRepository.findById(workId).orElseThrow {
            BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_FOUND)
        }
    }

    private fun getEntityForUpdate(workId: Long): SongAnalysisWorkEntity {
        return songAnalysisWorkRepository.findByIdForUpdate(workId)
            ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_FOUND)
    }

    /**
     * 한 행이 RUNNING 을 거치는 건 claim 한 번뿐이고 종료 상태는 다시 claim 되지 않는다. 그래서
     * 이 검사만으로 "이미 종료된 행에 뒤늦게 쓰는" 경우가 막힌다 — 소유자 비교가 따로 필요 없다.
     */
    private fun SongAnalysisWorkEntity.isRunning(): Boolean =
        status == SongAnalysisWorkStatus.RUNNING
}
