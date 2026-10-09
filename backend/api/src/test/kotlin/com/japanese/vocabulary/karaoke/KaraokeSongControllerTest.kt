package com.japanese.vocabulary.karaoke

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.karaoke.dto.KaraokeDailyGroupResponse
import com.japanese.vocabulary.karaoke.dto.KaraokeMonthlyResponse
import com.japanese.vocabulary.karaoke.dto.KaraokeSongItemResponse
import com.japanese.vocabulary.karaoke.entity.KaraokeSongEntity
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import java.time.LocalDate

@AutoConfigureMockMvc
class KaraokeSongControllerTest : ApiBaseIntegrationTest() {
    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil

    private lateinit var bearer: String

    @BeforeEach
    fun seed() {
        val user = TestUserBuilder(entityManager).build()
        bearer = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"
        // 2099 년이라 다른 테스트의 행과 섞이지 않는다.
        row(KaraokeVendor.TJ, 90901, "唱", "Ado", day(3), art = "https://art/sho.jpg")
        row(KaraokeVendor.KY, 57901, "唱", "Ado", day(3), songId = 77)
        row(KaraokeVendor.TJ, 90902, "怪獣", "サカナクション", day(1))
        row(KaraokeVendor.KY, 57902, "怪獣", "サカナクション", day(2))
        row(KaraokeVendor.TJ, 90903, "前の月", "誰か", LocalDate.of(2099, 9, 30))
        entityManager.flush()
    }

    @Test
    fun `karaoke songs require authentication`() {
        mockMvc.get("/api/karaoke-songs/daily?month=2099-10").andExpect { status { isForbidden() } }
    }

    @Test
    fun `daily merges only songs listed by both vendors on the same day`() {
        val body = get("/api/karaoke-songs/daily?month=2099-10")
        val groups = objectMapper.readValue<List<KaraokeDailyGroupResponse>>(body)

        assertThat(groups.map { it.listedOn }).containsExactly(day(3), day(2), day(1))
        assertThat(groups[0].songs).containsExactly(
            KaraokeSongItemResponse("唱", "Ado", "https://art/sho.jpg", tjNumber = 90901, kyNumber = 57901, songId = 77),
        )
        assertThat(groups[1].songs.single().let { it.tjNumber to it.kyNumber }).isEqualTo(null to 57902)
        assertThat(groups[2].songs.single().let { it.tjNumber to it.kyNumber }).isEqualTo(90902 to null)
    }

    @Test
    fun `monthly merges within the month and groups by artist`() {
        val body = get("/api/karaoke-songs/monthly?month=2099-10")
        val monthly = objectMapper.readValue<KaraokeMonthlyResponse>(body)

        assertThat(monthly.month).isEqualTo("2099-10")
        assertThat(monthly.songCount).isEqualTo(2)
        assertThat(monthly.artists.map { it.artist }).containsExactly("Ado", "サカナクション")
        assertThat(monthly.artists[1].songs.single().let { it.tjNumber to it.kyNumber }).isEqualTo(90902 to 57902)
    }

    @Test
    fun `rejects a malformed month`() {
        mockMvc.get("/api/karaoke-songs/daily?month=2099-1x") { header("Authorization", bearer) }
            .andExpect { status { is4xxClientError() } }
    }

    private fun get(path: String): String =
        mockMvc.get(path) { header("Authorization", bearer) }
            .andExpect { status { isOk() } }
            .andReturn().response.getContentAsString(Charsets.UTF_8)

    private fun day(d: Int) = LocalDate.of(2099, 10, d)

    private fun row(vendor: KaraokeVendor, number: Int, title: String, artist: String, listedOn: LocalDate, songId: Long? = null, art: String? = null) {
        entityManager.persist(
            KaraokeSongEntity(vendor = vendor, number = number, title = title, artist = artist, artworkUrl = art, listedOn = listedOn, songId = songId)
        )
    }
}
