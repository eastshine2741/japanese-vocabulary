package com.japanese.vocabulary.recommendation.batch

import com.japanese.vocabulary.applemusicrss.client.AppleMusicRssClient
import com.japanese.vocabulary.applemusicrss.client.dto.AppleMusicRssGenreDto
import com.japanese.vocabulary.applemusicrss.dto.AppleMusicRssChartSongDto
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.repository.SongRecommendationCandidateRepository
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import com.ninjasquad.springmockk.MockkBean
import io.mockk.every
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.batch.core.BatchStatus
import org.springframework.batch.core.Job
import org.springframework.batch.core.JobParametersBuilder
import org.springframework.batch.core.launch.JobLauncher
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AppleMusicRecommendationCollectJobIntegrationTest : BatchBaseIntegrationTest() {

    @MockkBean
    private lateinit var appleMusicRssClient: AppleMusicRssClient

    @Autowired
    private lateinit var jobLauncher: JobLauncher

    @Autowired
    @Qualifier("appleMusicRecommendationCollectJob")
    private lateinit var appleMusicRecommendationCollectJob: Job

    @Autowired
    private lateinit var candidateRepository: SongRecommendationCandidateRepository

    @Autowired
    private lateinit var jdbcTemplate: JdbcTemplate

    @BeforeEach
    fun resetBatchMetadata() {
        jdbcTemplate.update("DELETE FROM BATCH_STEP_EXECUTION_CONTEXT")
        jdbcTemplate.update("DELETE FROM BATCH_STEP_EXECUTION")
        jdbcTemplate.update("DELETE FROM BATCH_JOB_EXECUTION_CONTEXT")
        jdbcTemplate.update("DELETE FROM BATCH_JOB_EXECUTION_PARAMS")
        jdbcTemplate.update("DELETE FROM BATCH_JOB_EXECUTION")
        jdbcTemplate.update("DELETE FROM BATCH_JOB_INSTANCE")
    }

    @Test
    fun `collect job fetches Apple RSS and upserts recommendation candidates`() {
        val weekStartDate = LocalDate.of(2026, 6, 22)
        val sourceSongId = "apple-song-${System.nanoTime()}"
        every { appleMusicRssClient.fetchMostPlayedSongs(storefront = "jp", limit = 100) } returns listOf(
            AppleMusicRssChartSongDto(
                rank = 1,
                id = sourceSongId,
                name = "Test Song",
                artistName = "Test Artist",
                artistId = "apple-artist-1",
                artistUrl = "https://music.apple.com/jp/artist/apple-artist-1",
                artworkUrl100 = "https://example.com/artwork.jpg",
                url = "https://music.apple.com/jp/song/$sourceSongId",
                releaseDate = "2026-06-01",
                genres = listOf(AppleMusicRssGenreDto(genreId = "21", name = "J-Pop")),
            )
        )

        val execution = jobLauncher.run(
            appleMusicRecommendationCollectJob,
            JobParametersBuilder()
                .addLocalDate("weekStartDate", weekStartDate)
                .addLong("testRunId", System.nanoTime())
                .toJobParameters(),
        )

        assertThat(execution.status).isEqualTo(BatchStatus.COMPLETED)

        val candidate = candidateRepository.findBySourceAndWeekStartDateAndSourceSongId(
            source = RecommendationSource.APPLE_MUSIC_RSS,
            weekStartDate = weekStartDate,
            sourceSongId = sourceSongId,
        )

        assertThat(candidate).isNotNull
        assertThat(candidate!!.sourceRank).isEqualTo(1)
        assertThat(candidate.title).isEqualTo("Test Song")
        assertThat(candidate.artistName).isEqualTo("Test Artist")
        assertThat(candidate.releaseDate).isEqualTo(LocalDate.of(2026, 6, 1))
        assertThat(candidate.genresJson).contains("J-Pop")
    }

    @Test
    fun `collect job accepts command line style weekStartDate string parameter`() {
        val weekStartDate = LocalDate.of(2026, 6, 22)
        val sourceSongId = "apple-song-${System.nanoTime()}"
        every { appleMusicRssClient.fetchMostPlayedSongs(storefront = "jp", limit = 100) } returns listOf(
            AppleMusicRssChartSongDto(
                rank = 1,
                id = sourceSongId,
                name = "Command Line Song",
                artistName = "Command Line Artist",
                artistId = null,
                artistUrl = null,
                artworkUrl100 = null,
                url = null,
                releaseDate = null,
                genres = emptyList(),
            )
        )

        val execution = jobLauncher.run(
            appleMusicRecommendationCollectJob,
            JobParametersBuilder()
                .addString("weekStartDate", "2026-06-22")
                .addLong("testRunId", System.nanoTime())
                .toJobParameters(),
        )

        assertThat(execution.status).isEqualTo(BatchStatus.COMPLETED)
        assertThat(
            candidateRepository.findBySourceAndWeekStartDateAndSourceSongId(
                source = RecommendationSource.APPLE_MUSIC_RSS,
                weekStartDate = weekStartDate,
                sourceSongId = sourceSongId,
            )
        ).isNotNull
    }
}
