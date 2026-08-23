package com.japanese.vocabulary.recommendation

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.recommendation.dto.SongRecommendationResponse
import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.entity.SongRecommendationCandidateEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import java.time.LocalDate

@AutoConfigureMockMvc
class SongRecommendationControllerTest : ApiBaseIntegrationTest() {
    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil
    @Autowired private lateinit var redis: StringRedisTemplate

    @Test
    fun `recommendations require authentication`() {
        mockMvc.get("/api/songs/recommendations")
            .andExpect { status { isForbidden() } }
    }

    @Test
    fun `recommendations return latest published ready rows without recording recent listens`() {
        val user = newUser()
        val olderWeek = LocalDate.of(2026, 6, 15)
        val latestWeek = LocalDate.of(2026, 6, 22)
        publishedReady(title = "Older", artist = "Artist", weekStartDate = olderWeek, orderIndex = 0)
        val second = publishedReady(title = "Second", artist = "Artist B", weekStartDate = latestWeek, orderIndex = 2)
        val first = publishedReady(title = "First", artist = "Artist A", weekStartDate = latestWeek, orderIndex = 1)
        publishedUnsafeMissingAnalyzedLyric(title = "Unsafe", artist = "Artist C", weekStartDate = latestWeek, orderIndex = 0)
        entityManager.flush()
        entityManager.clear()

        val body = mockMvc.get("/api/songs/recommendations") {
            header("Authorization", bearer(user))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString

        val response = objectMapper.readValue<List<SongRecommendationResponse>>(body)
        assertThat(response.map { it.id }).containsExactly(first.recommendation.id, second.recommendation.id)
        assertThat(response.map { it.songId }).containsExactly(first.song.id, second.song.id)
        assertThat(response.map { it.title }).containsExactly("First", "Second")
        assertThat(response).allSatisfy { assertThat(it.weekStartDate).isEqualTo(latestWeek) }
        assertThat(redis.opsForZSet().zCard(recentKey(user.id!!)) ?: 0L).isZero()
    }

    @Test
    fun `recommendations include published rows created from existing analyzed song without work`() {
        val user = newUser()
        val weekStartDate = LocalDate.of(2026, 6, 22)
        val song = song(title = "Existing", artist = "Artist")
        val lyric = lyric(song = song, analyzed = true)
        val candidate = candidate(
            sourceSongId = "existing",
            title = "Existing",
            artist = "Artist",
            weekStartDate = weekStartDate,
        )
        val recommendation = recommendation(
            candidate = candidate,
            songId = song.id!!,
            lyricId = lyric.id!!,
            weekStartDate = weekStartDate,
            orderIndex = 0,
        )
        entityManager.flush()
        entityManager.clear()

        val body = mockMvc.get("/api/songs/recommendations") {
            header("Authorization", bearer(user))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString

        val response = objectMapper.readValue<List<SongRecommendationResponse>>(body)
        assertThat(response.map { it.id }).containsExactly(recommendation.id)
        assertThat(response.map { it.songId }).containsExactly(song.id)
    }

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private fun recentKey(userId: Long) = "user:$userId:recent_songs"

    private fun publishedReady(
        title: String,
        artist: String,
        weekStartDate: LocalDate,
        orderIndex: Int,
    ): PublishedFixture {
        val song = song(title = title, artist = artist)
        val lyric = lyric(song = song, analyzed = true)
        val candidate = candidate(
            sourceSongId = title,
            title = title,
            artist = artist,
            weekStartDate = weekStartDate,
        )
        val recommendation = recommendation(
            candidate = candidate,
            songId = song.id!!,
            lyricId = lyric.id!!,
            weekStartDate = weekStartDate,
            orderIndex = orderIndex,
        )
        return PublishedFixture(song = song, recommendation = recommendation)
    }

    private fun publishedUnsafeMissingAnalyzedLyric(
        title: String,
        artist: String,
        weekStartDate: LocalDate,
        orderIndex: Int,
    ) {
        val song = song(title = title, artist = artist)
        val lyric = lyric(song = song, analyzed = false)
        val candidate = candidate(
            sourceSongId = title,
            title = title,
            artist = artist,
            weekStartDate = weekStartDate,
        )
        recommendation(
            candidate = candidate,
            songId = song.id!!,
            lyricId = lyric.id!!,
            weekStartDate = weekStartDate,
            orderIndex = orderIndex,
        )
    }

    private fun song(title: String, artist: String): SongEntity {
        val song = SongEntity(title = title, artist = artist, artworkUrl = "https://example.com/$title.jpg")
        entityManager.persist(song)
        entityManager.flush()
        return song
    }

    private fun lyric(song: SongEntity, analyzed: Boolean): LyricEntity {
        val lyric = LyricEntity(
            songId = song.id!!,
            lyricType = LyricType.PLAIN,
            rawContent = emptyList(),
            analyzedContent = if (analyzed) emptyList() else null,
        )
        entityManager.persist(lyric)
        entityManager.flush()
        if (!analyzed) {
            entityManager.createNativeQuery("UPDATE lyrics SET analyzed_content = NULL WHERE id = :id")
                .setParameter("id", lyric.id)
                .executeUpdate()
            entityManager.flush()
        }
        return lyric
    }

    private fun candidate(
        sourceSongId: String,
        title: String,
        artist: String,
        weekStartDate: LocalDate,
    ): SongRecommendationCandidateEntity {
        val candidate = SongRecommendationCandidateEntity(
            source = RecommendationSource.APPLE_MUSIC_RSS,
            sourceSongId = sourceSongId,
            weekStartDate = weekStartDate,
            sourceRank = 1,
            status = RecommendationCandidateStatus.APPROVED,
            title = title,
            artistName = artist,
        )
        entityManager.persist(candidate)
        entityManager.flush()
        return candidate
    }

    private fun recommendation(
        candidate: SongRecommendationCandidateEntity,
        songId: Long,
        lyricId: Long,
        weekStartDate: LocalDate,
        orderIndex: Int,
    ): SongRecommendationEntity {
        val recommendation = SongRecommendationEntity(
            candidateId = candidate.id!!,
            weekStartDate = weekStartDate,
            status = SongRecommendationStatus.PUBLISHED,
            songId = songId,
            lyricId = lyricId,
            orderIndex = orderIndex,
        )
        entityManager.persist(recommendation)
        entityManager.flush()
        return recommendation
    }

    private data class PublishedFixture(
        val song: SongEntity,
        val recommendation: SongRecommendationEntity,
    )
}
