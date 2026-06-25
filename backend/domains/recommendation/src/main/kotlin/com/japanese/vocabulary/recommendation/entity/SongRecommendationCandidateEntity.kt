package com.japanese.vocabulary.recommendation.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EntityListeners
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant
import java.time.LocalDate

@Entity
@Table(
    name = "song_recommendation_candidate",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uk_song_rec_candidate_source_week_song",
            columnNames = ["source", "week_start_date", "source_song_id"],
        ),
    ],
    indexes = [
        Index(name = "idx_song_rec_candidate_status_week_rank", columnList = "status, week_start_date, source_rank"),
        Index(name = "idx_song_rec_candidate_work", columnList = "song_analysis_work_id"),
        Index(name = "idx_song_rec_candidate_song", columnList = "song_id"),
    ],
)
@EntityListeners(AuditingEntityListener::class)
class SongRecommendationCandidateEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    val source: RecommendationSource,

    @Column(name = "source_song_id", nullable = false, length = 128)
    val sourceSongId: String,

    @Column(name = "week_start_date", nullable = false)
    val weekStartDate: LocalDate,

    @Column(name = "source_rank", nullable = false)
    var sourceRank: Int,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    var status: RecommendationCandidateStatus = RecommendationCandidateStatus.PENDING,

    @Column(nullable = false)
    var title: String,

    @Column(name = "artist_name", nullable = false)
    var artistName: String,

    @Column(name = "duration_seconds")
    var durationSeconds: Int? = null,

    @Column(name = "artwork_url", length = 500)
    var artworkUrl: String? = null,

    @Column(name = "source_url", length = 500)
    var sourceUrl: String? = null,

    @Column(name = "source_artist_id", length = 128)
    var sourceArtistId: String? = null,

    @Column(name = "source_artist_url", length = 500)
    var sourceArtistUrl: String? = null,

    @Column(name = "release_date")
    var releaseDate: LocalDate? = null,

    @Column(name = "genres_json", columnDefinition = "JSON")
    var genresJson: String? = null,

    @Column(name = "song_analysis_work_id")
    var songAnalysisWorkId: Long? = null,

    @Column(name = "song_id")
    var songId: Long? = null,

    @Column(name = "lyric_id")
    var lyricId: Long? = null,

    @Column(name = "approved_at")
    var approvedAt: Instant? = null,

    @Column(name = "rejected_at")
    var rejectedAt: Instant? = null,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
) {
    fun updateSourceMetadata(
        sourceRank: Int,
        title: String,
        artistName: String,
        durationSeconds: Int?,
        artworkUrl: String?,
        sourceUrl: String?,
        sourceArtistId: String?,
        sourceArtistUrl: String?,
        releaseDate: LocalDate?,
        genresJson: String?,
    ) {
        this.sourceRank = sourceRank
        this.title = title
        this.artistName = artistName
        this.durationSeconds = durationSeconds
        this.artworkUrl = artworkUrl
        this.sourceUrl = sourceUrl
        this.sourceArtistId = sourceArtistId
        this.sourceArtistUrl = sourceArtistUrl
        this.releaseDate = releaseDate
        this.genresJson = genresJson
    }

    fun linkAnalysisWork(workId: Long) {
        songAnalysisWorkId = workId
    }

    fun linkAnalyzedSong(songId: Long, lyricId: Long) {
        this.songId = songId
        this.lyricId = lyricId
    }
}
