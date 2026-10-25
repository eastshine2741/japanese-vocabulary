package com.japanese.vocabulary.admin

import com.japanese.vocabulary.song.entity.ArtistEntity
import com.japanese.vocabulary.song.entity.ArtistYoutubeChannelEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@AutoConfigureMockMvc
class AdminArtistControllerTest : AdminBaseIntegrationTest() {

    @Test
    fun `search finds artists by part of the name`() {
        artist("Liella!")
        artist("Aqours")

        mockMvc.get("/admin/api/artists") {
            header("Authorization", "Bearer ${adminToken()}")
            param("query", "Lie")
        }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(1) }
            jsonPath("$[0].name") { value("Liella!") }
        }
    }

    @Test
    fun `a channel is added by id or channel URL, listed on the detail, and removed`() {
        val artist = artist("Liella!")

        add(artist.id!!, "https://www.youtube.com/channel/$CHANNEL_ID?si=x", "ラブライブ!スーパースター!!").andExpect {
            status { isCreated() }
            jsonPath("$.channelId") { value(CHANNEL_ID) }
            jsonPath("$.channelTitle") { value("ラブライブ!スーパースター!!") }
        }
        mockMvc.get("/admin/api/artists/${artist.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.artist.name") { value("Liella!") }
            jsonPath("$.youtubeChannels[0].channelId") { value(CHANNEL_ID) }
        }

        mockMvc.delete("/admin/api/artists/${artist.id}/youtube-channels/$CHANNEL_ID") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect { status { isNoContent() } }
        entityManager.flush()
        assertThat(
            entityManager.createQuery("select c from ArtistYoutubeChannelEntity c", ArtistYoutubeChannelEntity::class.java).resultList,
        ).isEmpty()
    }

    @Test
    fun `one channel can serve several artists, but not twice for the same artist`() {
        val group = artist("Liella!")
        val unit = artist("CatChu!")

        add(group.id!!, CHANNEL_ID, null).andExpect { status { isCreated() } }
        add(unit.id!!, CHANNEL_ID, null).andExpect { status { isCreated() } }
        add(group.id!!, CHANNEL_ID, null).andExpect {
            status { isConflict() }
            jsonPath("$.error") { value("ARTIST_YOUTUBE_CHANNEL_ALREADY_EXISTS") }
        }
    }

    @Test
    fun `a handle is rejected because resolving it needs YouTube, and unknown artists are not found`() {
        val artist = artist("Liella!")

        add(artist.id!!, "https://www.youtube.com/@LoveLive_staff", null).andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("YOUTUBE_CHANNEL_ID_INVALID") }
        }
        add(Long.MAX_VALUE, CHANNEL_ID, null).andExpect { status { isNotFound() } }
    }

    private fun add(artistId: Long, channel: String, title: String?) =
        mockMvc.post("/admin/api/artists/$artistId/youtube-channels") {
            header("Authorization", "Bearer ${adminToken()}")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(mapOf("channel" to channel, "channelTitle" to title))
        }

    private fun artist(name: String): ArtistEntity {
        val artist = ArtistEntity(appleMusicId = "am-$name", name = name)
        entityManager.persist(artist)
        entityManager.flush()
        return artist
    }

    private companion object {
        const val CHANNEL_ID = "UCabcdefghijklmnopqrstuv"
    }
}
