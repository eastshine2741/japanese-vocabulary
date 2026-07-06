package com.japanese.vocabulary.recommendation.service

import com.japanese.vocabulary.recommendation.dto.RecommendationCandidateDto
import com.japanese.vocabulary.recommendation.dto.RecommendationCandidateInputDto
import com.japanese.vocabulary.recommendation.dto.RecommendationOperationItemDto
import com.japanese.vocabulary.recommendation.dto.RecommendationOperationResultDto
import com.japanese.vocabulary.recommendation.dto.SongRecommendationDto
import com.japanese.vocabulary.recommendation.dto.toDto
import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.entity.SongRecommendationCandidateEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationStatus
import com.japanese.vocabulary.recommendation.repository.SongRecommendationCandidateRepository
import com.japanese.vocabulary.recommendation.repository.SongRecommendationRepository
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate

@Service
class SongRecommendationService(
    private val candidateRepository: SongRecommendationCandidateRepository,
    private val recommendationRepository: SongRecommendationRepository,
    private val songAnalysisWorkService: SongAnalysisWorkService,
    private val workRepository: SongAnalysisWorkRepository,
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
) {
    private val logger = LoggerFactory.getLogger(SongRecommendationService::class.java)

    @Transactional
    fun upsertCandidates(
        source: RecommendationSource,
        weekStartDate: LocalDate,
        candidates: List<RecommendationCandidateInputDto>,
    ): List<RecommendationCandidateDto> = candidates.map { input ->
        val entity = candidateRepository.findBySourceAndWeekStartDateAndSourceSongId(
            source = source,
            weekStartDate = weekStartDate,
            sourceSongId = input.sourceSongId,
        )?.also { existing ->
            existing.updateSourceMetadata(
                sourceRank = input.sourceRank,
                title = input.title,
                artistName = input.artistName,
                durationSeconds = input.durationSeconds,
                artworkUrl = input.artworkUrl,
                sourceUrl = input.sourceUrl,
                sourceArtistId = input.sourceArtistId,
                sourceArtistUrl = input.sourceArtistUrl,
                releaseDate = input.releaseDate,
                genresJson = input.genresJson,
            )
        } ?: candidateRepository.save(
            SongRecommendationCandidateEntity(
                source = source,
                sourceSongId = input.sourceSongId,
                weekStartDate = weekStartDate,
                sourceRank = input.sourceRank,
                title = input.title,
                artistName = input.artistName,
                durationSeconds = input.durationSeconds,
                artworkUrl = input.artworkUrl,
                sourceUrl = input.sourceUrl,
                sourceArtistId = input.sourceArtistId,
                sourceArtistUrl = input.sourceArtistUrl,
                releaseDate = input.releaseDate,
                genresJson = input.genresJson,
            )
        )

        entity.toDto()
    }

    @Transactional
    fun dispatchApprovedCandidates(): RecommendationOperationResultDto {
        val candidates = findApprovedCandidatesAwaitingAnalysis()
        val items = candidates.map { candidate ->
            dispatchCandidate(candidate)
        }
        return items.toOperationResult()
    }

    @Transactional
    fun reconcileCompletedWork(): RecommendationOperationResultDto {
        val candidates = findApprovedCandidatesAwaitingRecommendation()
        val items = candidates.map { candidate ->
            reconcileCandidate(candidate)
        }
        return items.toOperationResult()
    }

    @Transactional
    fun prepareApprovedCandidates(): RecommendationOperationResultDto {
        val candidates = candidateRepository.findApprovedWithoutRecommendation(operationPage()).map { it.toDto() }
        val items = candidates.map { candidate ->
            prepareCandidate(candidate)
        }
        return items.toOperationResult()
    }

    @Transactional(readOnly = true)
    fun listCandidates(
        weekStartDate: LocalDate?,
        status: RecommendationCandidateStatus?,
    ): List<RecommendationCandidateDto> {
        val effectiveWeekStartDate = weekStartDate ?: candidateRepository.findLatestWeekStartDate()
            ?: return emptyList()
        return candidateRepository.findCandidatesForWeek(
            weekStartDate = effectiveWeekStartDate,
            status = status,
            pageable = PageRequest.of(0, MAX_ADMIN_ROWS),
        ).map { it.toDto() }
    }

    @Transactional(readOnly = true)
    fun listRecommendations(weekStartDate: LocalDate?): List<SongRecommendationDto> {
        val effectiveWeekStartDate = weekStartDate ?: recommendationRepository.findLatestWeekStartDate()
            ?: return emptyList()
        return recommendationRepository.findByWeekStartDateOrderByOrderIndexAscCreatedAtAsc(effectiveWeekStartDate)
            .map { it.toDto() }
    }

    @Transactional
    fun updateCandidateStatus(
        candidateId: Long,
        status: RecommendationCandidateStatus,
    ): RecommendationCandidateDto {
        val candidate = candidateRepository.getReferenceById(candidateId)
        when (status) {
            RecommendationCandidateStatus.PENDING -> candidate.markPending()
            RecommendationCandidateStatus.APPROVED -> candidate.markApproved(Instant.now())
            RecommendationCandidateStatus.REJECTED -> candidate.markRejected(Instant.now())
        }
        return candidate.toDto()
    }

    @Transactional
    fun updateRecommendation(
        recommendationId: Long,
        status: SongRecommendationStatus?,
        orderIndex: Int?,
    ): SongRecommendationDto {
        val recommendation = recommendationRepository.getReferenceById(recommendationId)
        orderIndex?.let { recommendation.updateOrder(it) }
        when (status) {
            SongRecommendationStatus.PUBLISHED -> {
                validatePublishable(recommendation)
                recommendation.publish(Instant.now())
            }
            SongRecommendationStatus.PENDING -> recommendation.unpublish()
            null -> Unit
        }
        return recommendation.toDto()
    }

    @Transactional(readOnly = true)
    internal fun findApprovedCandidatesAwaitingAnalysis(): List<RecommendationCandidateDto> =
        candidateRepository.findApprovedAwaitingAnalysis(operationPage()).map { it.toDto() }

    @Transactional
    internal fun linkAnalysisWork(candidateId: Long, workId: Long): RecommendationCandidateDto {
        val candidate = candidateRepository.getReferenceById(candidateId)
        candidate.linkAnalysisWork(workId)
        return candidate.toDto()
    }

    @Transactional(readOnly = true)
    internal fun findApprovedCandidatesAwaitingRecommendation(): List<RecommendationCandidateDto> =
        candidateRepository.findApprovedAwaitingRecommendation(operationPage()).map { it.toDto() }

    @Transactional
    internal fun createPendingRecommendation(
        candidateId: Long,
        songId: Long,
        lyricId: Long,
    ): SongRecommendationDto {
        recommendationRepository.findByCandidateId(candidateId)?.let { return it.toDto() }

        val candidate = candidateRepository.getReferenceById(candidateId)
        require(candidate.status == RecommendationCandidateStatus.APPROVED) {
            "Only approved candidates can become recommendations."
        }

        candidate.linkAnalyzedSong(songId = songId, lyricId = lyricId)
        return recommendationRepository.save(
            SongRecommendationEntity(
                candidateId = requireNotNull(candidate.id),
                weekStartDate = candidate.weekStartDate,
                songId = songId,
                lyricId = lyricId,
            )
        ).toDto()
    }

    private fun dispatchCandidate(
        candidate: RecommendationCandidateDto,
    ): RecommendationOperationItemDto {
        return try {
            val work = songAnalysisWorkService.createOrReuse(
                title = candidate.title,
                artist = candidate.artistName,
                durationSeconds = candidate.durationSeconds,
                artworkUrl = candidate.artworkUrl,
                triggerSource = SongAnalysisTriggerSource.RECOMMENDATION,
                createdByUserId = null,
            )
            linkAnalysisWork(candidate.id, work.workId)
            logger.info(
                "Dispatched recommendation candidate analysis: candidateId={}, workId={}",
                candidate.id,
                work.workId,
            )
            RecommendationOperationItemDto(
                candidateId = candidate.id,
                status = OPERATION_SUCCEEDED,
                workId = work.workId,
            )
        } catch (e: Exception) {
            logger.error("Failed to dispatch recommendation candidate analysis: candidateId={}", candidate.id, e)
            RecommendationOperationItemDto(
                candidateId = candidate.id,
                status = OPERATION_FAILED,
                message = e.message,
            )
        }
    }

    private fun reconcileCandidate(
        candidate: RecommendationCandidateDto,
    ): RecommendationOperationItemDto {
        val workId = candidate.songAnalysisWorkId
            ?: return skipped(candidate.id, "Candidate is not linked to song analysis work.")
        val work = workRepository.findById(workId).orElse(null)
            ?: return skipped(candidate.id, "Song analysis work was not found.", workId)
        if (work.status != SongAnalysisWorkStatus.COMPLETED) {
            return skipped(candidate.id, "Song analysis work is not completed.", workId)
        }
        val songId = work.songId
        val lyricId = work.lyricId
        if (work.playerReadyAt == null || songId == null || lyricId == null) {
            return skipped(candidate.id, "Song analysis work is not player-ready.", workId)
        }

        val lyric = lyricRepository.findById(lyricId).orElse(null)
            ?: return skipped(candidate.id, "Lyric was not found.", workId)
        if (lyric.songId != songId) {
            return skipped(candidate.id, "Lyric does not belong to the analyzed song.", workId)
        }
        if (lyric.analyzedContent == null) {
            return skipped(candidate.id, "Lyric has not been analyzed.", workId)
        }

        return try {
            val recommendation = createPendingRecommendation(
                candidateId = candidate.id,
                songId = songId,
                lyricId = lyricId,
            )
            logger.info(
                "Created pending song recommendation: candidateId={}, workId={}, recommendationId={}",
                candidate.id,
                work.id,
                recommendation.id,
            )
            RecommendationOperationItemDto(
                candidateId = candidate.id,
                status = OPERATION_SUCCEEDED,
                workId = workId,
                recommendationId = recommendation.id,
            )
        } catch (e: Exception) {
            logger.error(
                "Failed to create pending song recommendation: candidateId={}, workId={}",
                candidate.id,
                work.id,
                e,
            )
            RecommendationOperationItemDto(
                candidateId = candidate.id,
                status = OPERATION_FAILED,
                workId = workId,
                message = e.message,
            )
        }
    }

    private fun prepareCandidate(
        candidate: RecommendationCandidateDto,
    ): RecommendationOperationItemDto {
        findExistingAnalyzedSong(candidate)?.let { existing ->
            return try {
                val recommendation = createPendingRecommendation(
                    candidateId = candidate.id,
                    songId = existing.songId,
                    lyricId = existing.lyricId,
                )
                RecommendationOperationItemDto(
                    candidateId = candidate.id,
                    status = OPERATION_SUCCEEDED,
                    recommendationId = recommendation.id,
                    message = "Created pending recommendation from an existing analyzed song.",
                )
            } catch (e: Exception) {
                logger.error("Failed to create recommendation from existing song: candidateId={}", candidate.id, e)
                RecommendationOperationItemDto(
                    candidateId = candidate.id,
                    status = OPERATION_FAILED,
                    message = e.message,
                )
            }
        }

        if (candidate.songAnalysisWorkId != null) {
            return reconcileCandidate(candidate)
        }

        return dispatchCandidate(candidate)
    }

    private fun findExistingAnalyzedSong(candidate: RecommendationCandidateDto): ExistingAnalyzedSong? {
        val song = songRepository.findByArtistAndTitle(candidate.artistName, candidate.title) ?: return null
        val songId = song.id ?: return null
        val lyric = lyricRepository.findBySongId(songId) ?: return null
        val lyricId = lyric.id ?: return null
        if (lyric.analyzedContent == null) return null
        return ExistingAnalyzedSong(songId = songId, lyricId = lyricId)
    }

    private fun validatePublishable(recommendation: SongRecommendationEntity) {
        val candidate = candidateRepository.getReferenceById(recommendation.candidateId)
        require(candidate.status == RecommendationCandidateStatus.APPROVED) {
            "Recommendation candidate must be approved before publishing."
        }
        require(candidate.songId == recommendation.songId && candidate.lyricId == recommendation.lyricId) {
            "Recommendation candidate song and lyric links must match the recommendation."
        }

        if (candidate.songAnalysisWorkId != null) {
            val work = workRepository.findById(candidate.songAnalysisWorkId!!).orElse(null)
            require(work != null) { "Linked song analysis work was not found." }
            require(work.status == SongAnalysisWorkStatus.COMPLETED) { "Linked song analysis work is not completed." }
            require(work.songId == recommendation.songId && work.lyricId == recommendation.lyricId) {
                "Linked song analysis work result does not match the recommendation."
            }
            require(work.playerReadyAt != null) { "Linked song analysis work is not player-ready." }
        }

        val lyric = lyricRepository.findById(recommendation.lyricId).orElse(null)
        require(lyric != null) { "Recommendation lyric was not found." }
        require(lyric.songId == recommendation.songId) { "Recommendation lyric does not belong to the song." }
        require(lyric.analyzedContent != null) { "Recommendation lyric has not been analyzed." }
    }

    private fun skipped(
        candidateId: Long,
        message: String,
        workId: Long? = null,
    ): RecommendationOperationItemDto =
        RecommendationOperationItemDto(
            candidateId = candidateId,
            status = OPERATION_SKIPPED,
            workId = workId,
            message = message,
        )

    private fun List<RecommendationOperationItemDto>.toOperationResult(): RecommendationOperationResultDto =
        RecommendationOperationResultDto(
            processed = size,
            succeeded = count { it.status == OPERATION_SUCCEEDED },
            skipped = count { it.status == OPERATION_SKIPPED },
            failed = count { it.status == OPERATION_FAILED },
            items = this,
        )

    private fun operationPage(): PageRequest = PageRequest.of(0, MAX_ADMIN_ROWS)

    companion object {
        private const val MAX_ADMIN_ROWS = 100
        private const val OPERATION_SUCCEEDED = "SUCCEEDED"
        private const val OPERATION_SKIPPED = "SKIPPED"
        private const val OPERATION_FAILED = "FAILED"
    }

    private data class ExistingAnalyzedSong(
        val songId: Long,
        val lyricId: Long,
    )
}
