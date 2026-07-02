package com.japanese.vocabulary.recommendation.dto

import java.time.LocalDate

data class RecommendationCandidateInputDto(
    val sourceSongId: String,
    val sourceRank: Int,
    val title: String,
    val artistName: String,
    val durationSeconds: Int? = null,
    val artworkUrl: String? = null,
    val sourceUrl: String? = null,
    val sourceArtistId: String? = null,
    val sourceArtistUrl: String? = null,
    val releaseDate: LocalDate? = null,
    val genresJson: String? = null,
)
