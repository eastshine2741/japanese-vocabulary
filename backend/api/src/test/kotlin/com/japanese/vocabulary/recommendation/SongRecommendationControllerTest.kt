package com.japanese.vocabulary.recommendation

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.recommendation.dto.SongRecommendationResponse
import com.japanese.vocabulary.recommendation.entity.RecommendedSongEntity
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
    fun `recommendations return songs in list order without recording recent listens`() {
        val user = newUser()
        val second = recommend(song("Second", "Artist B"), orderIndex = 1)
        val first = recommend(song("First", "Artist A"), orderIndex = 0)
        val tieAfterFirst = recommend(song("Unanalyzed", "Artist C"), orderIndex = 0)
        entityManager.flush()
        entityManager.clear()

        val body = mockMvc.get("/api/songs/recommendations") {
            header("Authorization", bearer(user))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString

        val response = objectMapper.readValue<List<SongRecommendationResponse>>(body)
        assertThat(response.map { it.id }).containsExactly(first.id, tieAfterFirst.id, second.id)
        assertThat(response.map { it.songId }).containsExactly(first.songId, tieAfterFirst.songId, second.songId)
        assertThat(response.map { it.title }).containsExactly("First", "Unanalyzed", "Second")
        assertThat(response.first().artworkUrl).isEqualTo("https://example.com/First.jpg")
        assertThat(body).doesNotContain("weekStartDate")
        assertThat(redis.opsForZSet().zCard(recentKey(user.id!!)) ?: 0L).isZero()
    }

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private fun recentKey(userId: Long) = "user:$userId:recent_songs"

    private fun song(title: String, artist: String): SongEntity {
        val song = SongEntity(title = title, artist = artist, artworkUrl = "https://example.com/$title.jpg")
        entityManager.persist(song)
        entityManager.flush()
        return song
    }

    private fun recommend(song: SongEntity, orderIndex: Int): RecommendedSongEntity {
        val recommendation = RecommendedSongEntity(songId = song.id!!, orderIndex = orderIndex)
        entityManager.persist(recommendation)
        entityManager.flush()
        return recommendation
    }
}
