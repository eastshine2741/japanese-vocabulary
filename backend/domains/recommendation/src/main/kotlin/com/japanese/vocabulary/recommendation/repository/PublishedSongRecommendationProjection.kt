package com.japanese.vocabulary.recommendation.repository

import java.time.LocalDate

interface PublishedSongRecommendationProjection {
    fun getId(): Long
    fun getSongId(): Long
    fun getTitle(): String
    fun getArtist(): String
    fun getArtworkUrl(): String?
    fun getWeekStartDate(): LocalDate
}
