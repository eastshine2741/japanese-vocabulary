package com.japanese.vocabulary.recommendation.service

import com.japanese.vocabulary.recommendation.dto.RecommendationCandidateDto
import com.japanese.vocabulary.recommendation.dto.RecommendationCandidateInputDto
import com.japanese.vocabulary.recommendation.dto.SongRecommendationDto
import com.japanese.vocabulary.recommendation.dto.toDto
import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.entity.SongRecommendationCandidateEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationEntity
import com.japanese.vocabulary.recommendation.repository.SongRecommendationCandidateRepository
import com.japanese.vocabulary.recommendation.repository.SongRecommendationRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@Service
class SongRecommendationService(
    private val candidateRepository: SongRecommendationCandidateRepository,
    private val recommendationRepository: SongRecommendationRepository,
) {
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

    @Transactional(readOnly = true)
    fun findApprovedCandidatesAwaitingAnalysis(limit: Int): List<RecommendationCandidateDto> =
        candidateRepository.findApprovedAwaitingAnalysis(PageRequest.of(0, limit)).map { it.toDto() }

    @Transactional
    fun linkAnalysisWork(candidateId: Long, workId: Long): RecommendationCandidateDto {
        val candidate = candidateRepository.getReferenceById(candidateId)
        candidate.linkAnalysisWork(workId)
        return candidate.toDto()
    }

    @Transactional(readOnly = true)
    fun findApprovedCandidatesAwaitingRecommendation(limit: Int): List<RecommendationCandidateDto> =
        candidateRepository.findApprovedAwaitingRecommendation(PageRequest.of(0, limit)).map { it.toDto() }

    @Transactional
    fun createPendingRecommendation(
        candidateId: Long,
        songId: Long,
        lyricId: Long,
    ): SongRecommendationDto {
        recommendationRepository.findByCandidateId(candidateId)?.let { return it.toDto() }

        val candidate = candidateRepository.getReferenceById(candidateId)
        require(candidate.status == RecommendationCandidateStatus.APPROVED) {
            "Only approved candidates can become recommendations."
        }
        require(candidate.songAnalysisWorkId != null) {
            "Candidate must be linked to song analysis work before recommendation creation."
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
}
