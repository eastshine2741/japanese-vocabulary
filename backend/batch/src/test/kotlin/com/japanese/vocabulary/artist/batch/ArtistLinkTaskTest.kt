package com.japanese.vocabulary.artist.batch

import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.repository.ArtistRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songsearch.client.applemusic.AppleMusicClient
import com.japanese.vocabulary.songsearch.dto.CatalogArtistDto
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import com.ninjasquad.springmockk.MockkBean
import io.mockk.every
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.DefaultApplicationArguments
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

// ArtistService.link 가 새 트랜잭션을 열어 테스트 트랜잭션의 곡을 못 본다. 실제로 커밋한다.
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class ArtistLinkTaskTest : BatchBaseIntegrationTest() {

    @MockkBean private lateinit var appleMusicClient: AppleMusicClient

    @Autowired private lateinit var task: ArtistLinkTask
    @Autowired private lateinit var songRepository: SongRepository
    @Autowired private lateinit var artistRepository: ArtistRepository

    private val songIds = mutableListOf<Long>()

    @BeforeEach
    fun stubCatalog() {
        every { appleMusicClient.findSongArtist(any(), any()) } returns null
    }

    @AfterEach
    fun cleanUp() {
        val artistIds = songRepository.findAllById(songIds).mapNotNull { it.artistId }
        songRepository.deleteAllById(songIds)
        artistRepository.deleteAllById(artistIds.distinct())
    }

    @Test
    fun `links unlinked songs found in the catalog and leaves the rest`() {
        val found = song("見つかる曲", "バッチ歌手")
        val missing = song("無い曲", "バッチ歌手")
        val linked = song("済んだ曲", "バッチ歌手", artistId = 1)
        every { appleMusicClient.findSongArtist("見つかる曲", "バッチ歌手") } returns
            CatalogArtistDto(id = "980001", name = "バッチ歌手", artworkUrl = null, url = null)

        task.run(DefaultApplicationArguments())

        val artistId = songRepository.findById(found.id!!).get().artistId
        assertThat(artistRepository.findById(artistId!!).get().appleMusicId).isEqualTo("980001")
        assertThat(songRepository.findById(missing.id!!).get().artistId).isNull()
        verify(exactly = 0) { appleMusicClient.findSongArtist("済んだ曲", any()) }
        assertThat(songRepository.findById(linked.id!!).get().artistId).isEqualTo(1)
    }

    @Test
    fun `a catalog failure fails the job after trying every song`() {
        val failing = song("落ちる曲", "バッチ歌手")
        val found = song("通る曲", "バッチ歌手")
        every { appleMusicClient.findSongArtist("落ちる曲", any()) } throws IllegalStateException("down")
        every { appleMusicClient.findSongArtist("通る曲", any()) } returns
            CatalogArtistDto(id = "980002", name = "バッチ歌手", artworkUrl = null, url = null)

        assertThatThrownBy { task.run(DefaultApplicationArguments()) }.isInstanceOf(IllegalStateException::class.java)

        assertThat(songRepository.findById(failing.id!!).get().artistId).isNull()
        assertThat(songRepository.findById(found.id!!).get().artistId).isNotNull
    }

    private fun song(title: String, artist: String, artistId: Long? = null): SongEntity =
        songRepository.save(SongEntity(title = title, artist = artist, artistId = artistId)).also { songIds += it.id!! }
}
