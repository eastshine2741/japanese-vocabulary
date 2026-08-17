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
    fun requestAnalysisForCandidates(candidateIds: List<Long>): RecommendationOperationResultDto {
        val requestedIds = candidateIds.distinct()
        if (requestedIds.isEmpty()) return emptyList<RecommendationOperationItemDto>().toOperationResult()
        val candidatesById = candidateRepository.findAllById(requestedIds).associateBy { requireNotNull(it.id) }
        val items = requestedIds.map { candidateId ->
            val candidate = candidatesById[candidateId]
                ?: return@map RecommendationOperationItemDto(
                    candidateId = candidateId,
                    status = OPERATION_FAILED,
                    message = "Recommendation candidate was not found.",
                )
            if (candidate.status != RecommendationCandidateStatus.APPROVED) {
                return@map RecommendationOperationItemDto(
                    candidateId = candidateId,
                    status = OPERATION_SKIPPED,
                    message = "Only approved candidates can request analysis.",
                )
            }
            if (recommendationRepository.existsByCandidateId(candidateId)) {
                return@map RecommendationOperationItemDto(
                    candidateId = candidateId,
                    status = OPERATION_SKIPPED,
                    message = "Candidate already has a recommendation.",
                )
            }
            dispatchCandidate(candidate.toDto())
        }
        return items.toOperationResult()
    }

    /**
     * Prepares approved candidates of a single week. The week is scoped because the admin candidate
     * list shows one week at a time; without scoping, approved candidates of other weeks that the
     * operator cannot see would join the batch and block it through the all-or-nothing gate below.
     */
    @Transactional
    fun prepareApprovedCandidates(weekStartDate: LocalDate?): RecommendationOperationResultDto {
        val effectiveWeekStartDate = weekStartDate ?: candidateRepository.findLatestWeekStartDate()
            ?: return emptyList<RecommendationOperationItemDto>().toOperationResult()
        val candidates = candidateRepository
            .findApprovedWithoutRecommendationForWeek(effectiveWeekStartDate, operationPage())
            .map { it.toDto() }
        val matches = candidates.map { candidate -> candidate to findAnalyzedSong(candidate) }
        val missingItems = matches
            .filterNot { (_, match) -> match.isReady }
            .map { (candidate, match) -> match.toOperationItem(candidate.id) }
        if (missingItems.isNotEmpty()) {
            val readyItems = matches
                .filter { (_, match) -> match.isReady }
                .map { (candidate, match) ->
                    RecommendationOperationItemDto(
                        candidateId = candidate.id,
                        status = OPERATION_READY,
                        songId = match.songId,
                        lyricId = match.lyricId,
                        message = "Candidate has an analyzed song but was not processed because other candidates are missing.",
                    )
                }
            return (readyItems + missingItems).toOperationResult()
        }
        val items = matches.map { (candidate, match) ->
            createPendingRecommendation(
                candidateId = candidate.id,
                weekStartDate = candidate.weekStartDate,
                songId = requireNotNull(match.songId),
                lyricId = requireNotNull(match.lyricId),
            )
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

    private fun createPendingRecommendation(
        candidateId: Long,
        weekStartDate: LocalDate,
        songId: Long,
        lyricId: Long,
    ): RecommendationOperationItemDto {
        return try {
            val existing = recommendationRepository.findByCandidateId(candidateId)
            val recommendation = existing ?: recommendationRepository.save(
                SongRecommendationEntity(
                    candidateId = candidateId,
                    weekStartDate = weekStartDate,
                    songId = songId,
                    lyricId = lyricId,
                )
            )
            RecommendationOperationItemDto(
                candidateId = candidateId,
                status = OPERATION_SUCCEEDED,
                songId = recommendation.songId,
                lyricId = recommendation.lyricId,
                recommendationId = recommendation.id,
            )
        } catch (e: Exception) {
            logger.error("Failed to create pending song recommendation: candidateId={}", candidateId, e)
            RecommendationOperationItemDto(
                candidateId = candidateId,
                status = OPERATION_FAILED,
                songId = songId,
                lyricId = lyricId,
                message = e.message,
            )
        }
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

    private fun findAnalyzedSong(candidate: RecommendationCandidateDto): AnalyzedSongMatch {
        val song = songRepository.findByArtistAndTitle(candidate.artistName, candidate.title)
            ?: return AnalyzedSongMatch(status = OPERATION_MISSING_SONG)
        val songId = song.id ?: return AnalyzedSongMatch(status = OPERATION_MISSING_SONG)
        val lyric = lyricRepository.findActiveBySongId(songId)
        val lyricId = lyric?.id
        if (lyric == null || lyricId == null || lyric.analyzedContent == null) {
            return AnalyzedSongMatch(
                status = OPERATION_MISSING_ANALYZED_LYRIC,
                songId = songId,
                message = "Song exists but active analyzed lyric was not found.",
            )
        }
        return AnalyzedSongMatch(
            status = OPERATION_READY,
            songId = songId,
            lyricId = lyricId,
        )
    }

    private fun validatePublishable(recommendation: SongRecommendationEntity) {
        val candidate = candidateRepository.getReferenceById(recommendation.candidateId)
        require(candidate.status == RecommendationCandidateStatus.APPROVED) {
            "Recommendation candidate must be approved before publishing."
        }

        val lyric = lyricRepository.findById(recommendation.lyricId).orElse(null)
        require(lyric != null) { "Recommendation lyric was not found." }
        require(lyric.songId == recommendation.songId) { "Recommendation lyric does not belong to the song." }
        require(lyric.analyzedContent != null) { "Recommendation lyric has not been analyzed." }
    }

    private fun List<RecommendationOperationItemDto>.toOperationResult(): RecommendationOperationResultDto =
        RecommendationOperationResultDto(
            processed = size,
            succeeded = count { it.status == OPERATION_SUCCEEDED },
            skipped = count { it.status == OPERATION_SKIPPED || it.status == OPERATION_READY },
            failed = count {
                it.status == OPERATION_FAILED ||
                    it.status == OPERATION_MISSING_SONG ||
                    it.status == OPERATION_MISSING_ANALYZED_LYRIC
            },
            items = this,
        )

    private fun operationPage(): PageRequest = PageRequest.of(0, MAX_ADMIN_ROWS)

    companion object {
        private const val MAX_ADMIN_ROWS = 100
        private const val OPERATION_SUCCEEDED = "SUCCEEDED"
        private const val OPERATION_SKIPPED = "SKIPPED"
        private const val OPERATION_FAILED = "FAILED"
        private const val OPERATION_READY = "READY"
        private const val OPERATION_MISSING_SONG = "MISSING_SONG"
        private const val OPERATION_MISSING_ANALYZED_LYRIC = "MISSING_ANALYZED_LYRIC"
    }

    private data class AnalyzedSongMatch(
        val status: String,
        val songId: Long? = null,
        val lyricId: Long? = null,
        val message: String? = null,
    ) {
        val isReady: Boolean = status == OPERATION_READY && songId != null && lyricId != null

        fun toOperationItem(candidateId: Long): RecommendationOperationItemDto =
            RecommendationOperationItemDto(
                candidateId = candidateId,
                status = status,
                songId = songId,
                lyricId = lyricId,
                message = message ?: when (status) {
                    OPERATION_MISSING_SONG -> "Song was not found for candidate title and artist."
                    OPERATION_MISSING_ANALYZED_LYRIC -> "Analyzed lyric was not found for candidate song."
                    else -> null
                },
            )
    }
}
