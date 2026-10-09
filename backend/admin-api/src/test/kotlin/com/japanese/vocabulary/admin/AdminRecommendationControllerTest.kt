package com.japanese.vocabulary.admin

import com.japanese.vocabulary.recommendation.entity.RecommendedSongEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.containsString
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.options
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put

@AutoConfigureMockMvc
class AdminRecommendationControllerTest : AdminBaseIntegrationTest() {
    @Test
    fun `cors preflight allows put and delete`() {
        listOf("PUT", "DELETE").forEach { method ->
            mockMvc.options("/admin/api/recommendations/order") {
                header("Origin", "http://localhost:5174")
                header("Access-Control-Request-Method", method)
                header("Access-Control-Request-Headers", "authorization,content-type")
            }.andExpect {
                status { isOk() }
                header { string("Access-Control-Allow-Methods", containsString(method)) }
            }
        }
    }

    @Test
    fun `add appends songs to the end and list returns them in order`() {
        val first = song("一曲目", "https://example.com/1.jpg")
        val second = song("二曲目", null)

        add(first.id!!).andExpect {
            status { isCreated() }
            jsonPath("$.id") { exists() }
            jsonPath("$.songId") { value(first.id!!.toInt()) }
            jsonPath("$.title") { value("一曲目") }
            jsonPath("$.artist") { value(first.artist) }
            jsonPath("$.artworkUrl") { value("https://example.com/1.jpg") }
            jsonPath("$.orderIndex") { value(0) }
            jsonPath("$.createdAt") { exists() }
        }
        add(second.id!!).andExpect {
            status { isCreated() }
            jsonPath("$.orderIndex") { value(1) }
        }

        mockMvc.get("/admin/api/recommendations") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(2) }
            jsonPath("$[0].songId") { value(first.id!!.toInt()) }
            jsonPath("$[1].songId") { value(second.id!!.toInt()) }
            jsonPath("$[1].artworkUrl") { doesNotExist() }
        }
    }

    @Test
    fun `adding an already recommended song is a conflict`() {
        val song = song("重複曲", null)
        add(song.id!!).andExpect { status { isCreated() } }

        add(song.id!!).andExpect {
            status { isConflict() }
            jsonPath("$.error") { value("SONG_ALREADY_RECOMMENDED") }
        }
    }

    @Test
    fun `adding an unknown song is not found`() {
        add(Long.MAX_VALUE).andExpect { status { isNotFound() } }
    }

    @Test
    fun `delete removes the recommendation and missing ids are not found`() {
        val recommendation = persistRecommendation(song("削除曲", null), orderIndex = 0)

        mockMvc.delete("/admin/api/recommendations/${recommendation.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect { status { isNoContent() } }

        entityManager.flush()
        entityManager.clear()
        assertThat(entityManager.find(RecommendedSongEntity::class.java, recommendation.id)).isNull()

        mockMvc.delete("/admin/api/recommendations/${recommendation.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `reorder rewrites order indexes in the given order`() {
        val a = persistRecommendation(song("A", null), orderIndex = 0)
        val b = persistRecommendation(song("B", null), orderIndex = 5)
        val c = persistRecommendation(song("C", null), orderIndex = 9)

        reorder(listOf(c.id!!, a.id!!, b.id!!)).andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(3) }
            jsonPath("$[0].id") { value(c.id!!.toInt()) }
            jsonPath("$[0].orderIndex") { value(0) }
            jsonPath("$[1].id") { value(a.id!!.toInt()) }
            jsonPath("$[1].orderIndex") { value(1) }
            jsonPath("$[2].id") { value(b.id!!.toInt()) }
            jsonPath("$[2].orderIndex") { value(2) }
        }
    }

    @Test
    fun `reorder rejects ids that do not exactly match the current list`() {
        val a = persistRecommendation(song("A", null), orderIndex = 0)
        val b = persistRecommendation(song("B", null), orderIndex = 1)

        listOf(
            listOf(a.id!!),
            listOf(a.id!!, a.id!!),
            listOf(a.id!!, b.id!!, Long.MAX_VALUE),
            listOf(a.id!!, a.id!!, b.id!!),
        ).forEach { ids ->
            reorder(ids).andExpect { status { isBadRequest() } }
        }
    }

    private fun add(songId: Long) =
        mockMvc.post("/admin/api/recommendations") {
            header("Authorization", "Bearer ${adminToken()}")
            contentType = MediaType.APPLICATION_JSON
            content = """{"songId":$songId}"""
        }

    private fun reorder(ids: List<Long>) =
        mockMvc.put("/admin/api/recommendations/order") {
            header("Authorization", "Bearer ${adminToken()}")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(mapOf("ids" to ids))
        }

    private fun song(title: String, artworkUrl: String?): SongEntity =
        TestSongBuilder(entityManager)
            .withTitle(title)
            .withArtworkUrl(artworkUrl)
            .build()

    private fun persistRecommendation(song: SongEntity, orderIndex: Int): RecommendedSongEntity =
        RecommendedSongEntity(songId = song.id!!, orderIndex = orderIndex).also {
            entityManager.persist(it)
            entityManager.flush()
        }
}
