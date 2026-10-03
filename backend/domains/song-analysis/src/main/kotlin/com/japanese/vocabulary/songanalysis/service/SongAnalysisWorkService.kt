package com.japanese.vocabulary.songanalysis.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisWorkDto
import com.japanese.vocabulary.songanalysis.dto.toDto
import com.japanese.vocabulary.songanalysis.dto.ClaimedSongAnalysisStage
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisStageRef
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisStageTarget
import com.japanese.vocabulary.songanalysis.dto.toSnapshot
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisStageFailure
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisStageStatus
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStageEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.event.SongAnalysisWorkQueuedEvent
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkStageRepository
import org.springframework.context.ApplicationEventPublisher
import org.springframework.dao.ConcurrencyFailureException
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.annotation.Propagation
import org.springframework.data.domain.Pageable
import java.time.Instant

@Service
class SongAnalysisWorkService(
    private val songAnalysisWorkRepository: SongAnalysisWorkRepository,
    private val stageRepository: SongAnalysisWorkStageRepository,
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
     * 메시지 하나가 가리키는 단계를 잡는다. 잡히지 않으면 null 이고 메시지는 조용히 ack 된다.
     *
     * - 작업이 기다리는 단계([SongAnalysisWorkEntity.currentStage])가 아닌 메시지는 낡은 것이다.
     * - 같은 메시지가 두 번 오면 두 번째는 RUNNING 인 단계 행을 만나 버려진다.
     * - 단, [redelivered] 메시지가 RUNNING 단계를 만나면 넘겨받는다. 브로커는 처리 중이던 consumer
     *   의 연결이 끊겼을 때만 메시지를 다시 배달하므로, 그 단계를 돌던 worker 는 죽은 것이다.
     *   attempt 가 올라가서, 혹시 살아 있던 원래 worker 가 뒤늦게 쓰는 결과는 펜스에 걸린다.
     *
     * 첫 단계를 잡을 때 작업이 PENDING 에서 RUNNING 이 되고 [SongAnalysisWorkEntity.startedAt] 이
     * 찍힌다. 재시도 마감은 거기서부터 잰다.
     */
    @Transactional
    fun claimStage(
        workId: Long,
        stage: SongAnalysisWorkStage,
        redelivered: Boolean,
    ): ClaimedSongAnalysisStage? {
        val now = Instant.now()
        val work = songAnalysisWorkRepository.findByIdForUpdate(workId) ?: return null
        if (stage != (work.currentStage ?: SongAnalysisWorkStage.FIRST)) return null
        when (work.status) {
            SongAnalysisWorkStatus.PENDING -> {
                work.status = SongAnalysisWorkStatus.RUNNING
                work.startedAt = now
                work.clearFailure()
            }
            // started_at 이 없는 RUNNING 은 단계 원장 이전 파이프라인이 잡은 작업이다. 그 파드가 아직 돌고
            // 있을 수 있고 앞 단계 산출물도 없으므로 넘겨받지 않는다 — 끝나거나 sweeper 가 정리한다.
            SongAnalysisWorkStatus.RUNNING -> if (work.startedAt == null) return null
            else -> return null
        }

        val row = stageRepository.findByWorkIdAndStage(workId, stage)
            ?: SongAnalysisWorkStageEntity(workId = workId, stage = stage)
        when (row.status) {
            SongAnalysisStageStatus.PENDING -> Unit
            SongAnalysisStageStatus.RUNNING -> if (!redelivered) return null
            SongAnalysisStageStatus.COMPLETED, SongAnalysisStageStatus.FAILED -> return null
        }
        row.start(now)
        stageRepository.save(row)

        work.currentStage = stage
        work.updatedAt = now
        songAnalysisWorkRepository.saveAndFlush(work)
        return ClaimedSongAnalysisStage(
            ref = SongAnalysisStageRef(workId, stage, row.attempt),
            work = work.toSnapshot(),
            startedAt = requireNotNull(work.startedAt),
            previousOutput = row.output,
        )
    }

    /** 끝난 단계의 산출물. 다음 단계가 입력으로 읽는다. */
    @Transactional(readOnly = true)
    fun completedOutputs(workId: Long): Map<SongAnalysisWorkStage, String?> =
        stageRepository.findByWorkIdOrderByIdAsc(workId)
            .filter { it.status == SongAnalysisStageStatus.COMPLETED }
            .associate { it.stage to it.output }

    /**
     * 단계가 끝나기 전에 산출물 일부를 남긴다. 실패해도 끝난 부분은 다음 시도가 다시 하지 않고,
     * 작업 행의 updated_at 이 움직이므로 sweeper 의 멈춤 판정에 대한 heartbeat 이기도 하다.
     */
    @Transactional
    fun recordProgress(ref: SongAnalysisStageRef, output: String): Boolean {
        val (work, row) = lockCurrent(ref) ?: return false
        row.output = output
        work.updatedAt = Instant.now()
        return true
    }

    /** CREATE_SONG_AND_LYRIC 가 곡과 가사를 만든 같은 트랜잭션 안에서 부른다. */
    @Transactional(propagation = Propagation.MANDATORY)
    fun attachPlayerReady(ref: SongAnalysisStageRef, songId: Long, lyricId: Long, youtubeUrl: String?): Boolean {
        val (work, _) = lockCurrent(ref) ?: return false
        work.attachPlayerReady(songId, lyricId, youtubeUrl, Instant.now())
        return true
    }

    /**
     * 단계를 끝내고 다음 단계를 깨운다. 마지막 단계면 작업을 COMPLETED 로 닫는다. 펜스에 걸리면
     * (sweeper 가 이미 포기 처리했거나 다른 worker 가 넘겨받았으면) false 다 — 호출자는 같은
     * 트랜잭션에서 한 쓰기를 롤백해야 한다.
     */
    @Transactional
    fun completeStage(ref: SongAnalysisStageRef, output: String?): Boolean {
        val (work, row) = lockCurrent(ref) ?: return false
        val now = Instant.now()
        row.complete(output, now)
        val next = ref.stage.next
        if (next == null) {
            work.markCompleted(now)
        } else {
            work.currentStage = next
            work.updatedAt = now
            eventPublisher.publishEvent(SongAnalysisWorkQueuedEvent(ref.workId, next))
        }
        return true
    }

    @Transactional
    fun failStage(ref: SongAnalysisStageRef, failure: SongAnalysisStageFailure): Boolean {
        val (work, row) = lockCurrent(ref) ?: return false
        val now = Instant.now()
        row.fail(failure, now)
        work.markFailed(failure.code, failure.userMessage, now)
        return true
    }

    /**
     * 실패한 작업을 실패한 단계부터 다시 돌린다. 앞 단계의 산출물은 그대로 쓰고, 가사 분석 단계라면
     * 끝난 갈래도 다시 하지 않는다. 마감은 새로 잰다.
     *
     * 같은 곡에 이미 활성 작업이 있으면 409 다. 이 경로는 행을 새로 만들지 않고 상태만 되살리므로
     * 갭 락이 막아 주는 경합 중 하나가 남는다 — 이 트랜잭션과 정확히 겹친 유저 요청이 새 행을 만들 수
     * 있다. 관리자 수동 조작과 유저 요청이 같은 곡에서 밀리초 단위로 겹쳐야 하므로 받아들인다.
     */
    @Transactional
    fun resume(workId: Long): SongAnalysisWorkDto {
        val work = getEntityForUpdate(workId)
        if (work.status != SongAnalysisWorkStatus.FAILED) {
            throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_RESUMABLE)
        }
        val stage = work.currentStage ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_RESUMABLE)
        // 단계 원장이 생기기 전에 실패한 작업은 이어 갈 산출물이 없다. 원장은 있는데 실패한 단계의 행이
        // 없는 건, 앞 단계를 끝낸 뒤 다음 단계 메시지를 끝내 못 받고 시간 초과된 경우다.
        val rows = stageRepository.findByWorkIdOrderByIdAsc(workId)
        if (rows.isEmpty()) throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_RESUMABLE)
        val row = rows.firstOrNull { it.stage == stage }
            ?: stageRepository.save(SongAnalysisWorkStageEntity(workId = workId, stage = stage))

        val activeStatuses = listOf(SongAnalysisWorkStatus.PENDING, SongAnalysisWorkStatus.RUNNING)
        val blocker = work.songId?.let { songId ->
            songAnalysisWorkRepository.findBySongIdAndStatusInOrderByCreatedAtAsc(songId, activeStatuses).firstOrNull()
        } ?: songAnalysisWorkRepository.findActiveByRawSongForUpdate(work.rawTitle, work.rawArtist).firstOrNull()
        if (blocker != null) throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_ALREADY_EXISTS)

        work.status = SongAnalysisWorkStatus.PENDING
        work.clearFailure()
        work.startedAt = null
        work.updatedAt = Instant.now()
        row.status = SongAnalysisStageStatus.PENDING
        eventPublisher.publishEvent(SongAnalysisWorkQueuedEvent(workId, stage))
        return work.toDto()
    }

    @Transactional(readOnly = true)
    fun countByStatus(status: SongAnalysisWorkStatus): Long = songAnalysisWorkRepository.countByStatus(status)

    @Transactional(readOnly = true)
    fun stages(workId: Long): List<SongAnalysisWorkStageEntity> = stageRepository.findByWorkIdOrderByIdAsc(workId)

    /**
     * 메시지를 잃은 작업. 큐가 살아 있으면 발행 직후 처리되므로 이만큼 멈춰 있으면 메시지가 없다고 본다.
     * - PENDING: 커밋과 발행 사이의 크래시, 발행 실패, 브로커 재시작.
     * - RUNNING 인데 기다리는 단계가 돌고 있지 않음: 앞 단계가 끝난 뒤 다음 단계 발행을 잃었다.
     *
     * 바쁜 consumer 앞에서 기다리던 메시지라면 중복이 되지만, 둘째 메시지는 claim 에서 버려진다.
     */
    @Transactional(readOnly = true)
    fun findLostMessages(olderThan: Instant, limit: Int): List<SongAnalysisStageTarget> {
        val pending = songAnalysisWorkRepository.findStalePending(olderThan, Pageable.ofSize(limit))
        val running = songAnalysisWorkRepository.findStaleRunning(olderThan, Pageable.ofSize(limit))
            // 단계 원장 이전에 잡힌 작업은 claimStage 가 받지 않으므로 다시 발행해도 소용없다.
            .filter { it.startedAt != null }
            .filter { work ->
                val stage = work.currentStage ?: return@filter false
                stageRepository.findByWorkIdAndStage(work.id!!, stage)?.status != SongAnalysisStageStatus.RUNNING
            }
        return (pending + running).map { SongAnalysisStageTarget(it.id!!, it.currentStage ?: SongAnalysisWorkStage.FIRST) }
    }

    /**
     * 진행이 멈춘 RUNNING 행을 FAILED 로 넘긴다. 재시도가 아니라 포기 처리다 — 이걸 하지 않으면
     * 멈춘 행이 계속 활성으로 잡혀서 그 곡은 새 요청을 받지 못한다. worker 가 죽은 경우는 대개
     * 브로커의 재배달이 먼저 넘겨받으므로, 여기 걸리는 건 재배달도 못 받은 경우다.
     */
    @Transactional
    fun failStaleRunning(olderThan: Instant, limit: Int): Int {
        val expired = songAnalysisWorkRepository.findStaleRunningForUpdate(
            olderThan,
            Pageable.ofSize(limit),
        )
        val now = Instant.now()
        val timeout = SongAnalysisStageFailure(
            code = ErrorCode.SONG_ANALYSIS_WORK_TIMEOUT.name,
            userMessage = ErrorCode.SONG_ANALYSIS_WORK_TIMEOUT.message,
            errorClass = null,
            detail = "No progress since before $olderThan",
        )
        expired.forEach { work ->
            work.currentStage
                ?.let { stageRepository.findByWorkIdAndStage(work.id!!, it) }
                ?.takeIf { it.status == SongAnalysisStageStatus.RUNNING }
                ?.fail(timeout, now)
            work.markFailed(timeout.code, timeout.userMessage, now)
        }
        songAnalysisWorkRepository.saveAllAndFlush(expired)
        return expired.size
    }

    /**
     * 펜스. 작업이 RUNNING 이고, 그 단계를 기다리고 있고, 단계 행이 이 attempt 로 돌고 있어야 한다.
     * 한 단계를 잡을 때마다 attempt 가 오르므로, 넘겨받힌 worker 나 sweeper 가 포기 처리한 뒤의
     * worker 는 여기서 걸러진다.
     */
    private fun lockCurrent(ref: SongAnalysisStageRef): Pair<SongAnalysisWorkEntity, SongAnalysisWorkStageEntity>? {
        val work = getEntityForUpdate(ref.workId)
        if (work.status != SongAnalysisWorkStatus.RUNNING || work.currentStage != ref.stage) return null
        val row = stageRepository.findByWorkIdAndStage(ref.workId, ref.stage) ?: return null
        if (row.status != SongAnalysisStageStatus.RUNNING || row.attempt != ref.attempt) return null
        return work to row
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
}
