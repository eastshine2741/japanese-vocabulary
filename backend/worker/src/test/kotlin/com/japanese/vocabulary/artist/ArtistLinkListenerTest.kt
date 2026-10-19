package com.japanese.vocabulary.artist

import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.repository.ArtistRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.event.SongAnalysisCompletedEvent
import com.japanese.vocabulary.songsearch.dto.CatalogArtistDto
import com.japanese.vocabulary.test.WorkerBaseIntegrationTest
import io.mockk.every
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate

// 리스너는 AFTER_COMMIT 이라 실제로 커밋해야 불린다.
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class ArtistLinkListenerTest : WorkerBaseIntegrationTest() {

    @Autowired private lateinit var songRepository: SongRepository
    @Autowired private lateinit var artistRepository: ArtistRepository
    @Autowired private lateinit var eventPublisher: ApplicationEventPublisher
    @Autowired private lateinit var transactionTemplate: TransactionTemplate

    private val songIds = mutableListOf<Long>()

    @AfterEach
    fun cleanUp() {
        val artistIds = songRepository.findAllById(songIds).mapNotNull { it.artistId }
        songRepository.deleteAllById(songIds)
        artistRepository.deleteAllById(artistIds.distinct())
    }

    @Test
    fun `completed analysis links the song to its catalog artist, sharing one row per artist`() {
        val first = song("リンク一")
        val second = song("リンク二")
        every { appleMusicClient.findSongArtist(any(), "テスト歌手") } returns
            CatalogArtistDto(id = "990001", name = "テスト歌手", artworkUrl = "https://img/a.jpg", url = "https://music/a")

        complete(first)
        complete(second)

        val firstArtistId = songRepository.findById(first.id!!).get().artistId
        assertThat(firstArtistId).isNotNull
        assertThat(songRepository.findById(second.id!!).get().artistId).isEqualTo(firstArtistId)
        with(artistRepository.findById(firstArtistId!!).get()) {
            assertThat(appleMusicId).isEqualTo("990001")
            assertThat(artworkUrl).isEqualTo("https://img/a.jpg")
            assertThat(appleMusicUrl).isEqualTo("https://music/a")
        }
    }

    @Test
    fun `a catalog failure leaves the song without an artist`() {
        val song = song("リンク失敗")
        every { appleMusicClient.findSongArtist(any(), any()) } throws IllegalStateException("down")

        complete(song)

        assertThat(songRepository.findById(song.id!!).get().artistId).isNull()
    }

    @Test
    fun `an already linked song is not looked up again`() {
        val song = song("リンク済み")
        transactionTemplate.executeWithoutResult { songRepository.updateArtistId(song.id!!, 1) }

        complete(song)

        verify(exactly = 0) { appleMusicClient.findSongArtist(any(), any()) }
    }

    private fun song(title: String): SongEntity =
        songRepository.save(SongEntity(title = title, artist = "テスト歌手")).also { songIds += it.id!! }

    private fun complete(song: SongEntity) = transactionTemplate.executeWithoutResult {
        eventPublisher.publishEvent(SongAnalysisCompletedEvent(workId = 1, songId = song.id!!))
    }
}
