package com.japanese.vocabulary.recommendation.dto

import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.entity.SongRecommendationCandidateEntity
import java.time.Instant
import java.time.LocalDate

data class RecommendationCandidateDto(
    val id: Long,
    val source: RecommendationSource,
    val sourceSongId: String,
    val weekStartDate: LocalDate,
    val sourceRank: Int,
    val status: RecommendationCandidateStatus,
    val title: String,
    val artistName: String,
    val durationSeconds: Int?,
    val artworkUrl: String?,
    val sourceUrl: String?,
    val sourceArtistId: String?,
    val sourceArtistUrl: String?,
    val releaseDate: LocalDate?,
    val genresJson: String?,
    val songAnalysisWorkId: Long?,
    val songId: Long?,
    val lyricId: Long?,
    val createdAt: Instant?,
    val updatedAt: Instant?,
)

fun SongRecommendationCandidateEntity.toDto(): RecommendationCandidateDto = RecommendationCandidateDto(
    id = requireNotNull(id),
    source = source,
    sourceSongId = sourceSongId,
    weekStartDate = weekStartDate,
    sourceRank = sourceRank,
    status = status,
    title = title,
    artistName = artistName,
    durationSeconds = durationSeconds,
    artworkUrl = artworkUrl,
    sourceUrl = sourceUrl,
    sourceArtistId = sourceArtistId,
    sourceArtistUrl = sourceArtistUrl,
    releaseDate = releaseDate,
    genresJson = genresJson,
    songAnalysisWorkId = songAnalysisWorkId,
    songId = songId,
    lyricId = lyricId,
    createdAt = createdAt,
    updatedAt = updatedAt,
)
