package com.japanese.vocabulary.karaoke

import com.japanese.vocabulary.karaoke.entity.KaraokeSongEntity
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
import com.japanese.vocabulary.karaoke.repository.KaraokeSongRepository
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.event.SongAnalysisCompletedEvent
import com.japanese.vocabulary.test.WorkerBaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDate

// 리스너는 AFTER_COMMIT 이라 실제로 커밋해야 불린다.
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class KaraokeSongLinkListenerTest : WorkerBaseIntegrationTest() {

    @Autowired private lateinit var karaokeSongRepository: KaraokeSongRepository
    @Autowired private lateinit var songRepository: SongRepository
    @Autowired private lateinit var eventPublisher: ApplicationEventPublisher
    @Autowired private lateinit var transactionTemplate: TransactionTemplate

    private val songIds = mutableListOf<Long>()
    private val rowIds = mutableListOf<Long>()

    @AfterEach
    fun cleanUp() {
        karaokeSongRepository.deleteAllById(rowIds)
        songRepository.deleteAllById(songIds)
    }

    @Test
    fun `completed analysis links unlinked karaoke rows with the same title and artist`() {
        val song = songRepository.save(SongEntity(title = "リンクテスト", artist = "テスト歌手")).also { songIds += it.id!! }
        val tj = row(KaraokeVendor.TJ, 99001, "リンクテスト", "テスト歌手")
        val ky = row(KaraokeVendor.KY, 99002, "リンクテスト", "テスト歌手")
        val other = row(KaraokeVendor.TJ, 99003, "別の歌", "テスト歌手")

        transactionTemplate.executeWithoutResult {
            eventPublisher.publishEvent(SongAnalysisCompletedEvent(workId = 1, songId = song.id!!))
        }

        assertThat(karaokeSongRepository.findById(tj.id!!).get().songId).isEqualTo(song.id)
        assertThat(karaokeSongRepository.findById(ky.id!!).get().songId).isEqualTo(song.id)
        assertThat(karaokeSongRepository.findById(other.id!!).get().songId).isNull()
    }

    private fun row(vendor: KaraokeVendor, number: Int, title: String, artist: String): KaraokeSongEntity =
        karaokeSongRepository.save(
            KaraokeSongEntity(vendor = vendor, number = number, title = title, artist = artist, listedOn = LocalDate.of(2026, 10, 5))
        ).also { rowIds += it.id!! }
}
