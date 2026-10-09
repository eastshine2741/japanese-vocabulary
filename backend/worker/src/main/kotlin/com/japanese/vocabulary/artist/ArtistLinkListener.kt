package com.japanese.vocabulary.artist

import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.ArtistService
import com.japanese.vocabulary.songanalysis.event.SongAnalysisCompletedEvent
import com.japanese.vocabulary.songsearch.client.applemusic.AppleMusicClient
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

/** 아티스트가 없어도 곡은 열려야 하므로 실패는 삼킨다. 놓친 곡은 batch `artist-link` 가 매일 다시 잇는다. */
@Component
class ArtistLinkListener(
    private val songRepository: SongRepository,
    private val appleMusicClient: AppleMusicClient,
    private val artistService: ArtistService,
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onCompleted(event: SongAnalysisCompletedEvent) {
        try {
            val song = songRepository.findById(event.songId).orElse(null) ?: return
            if (song.artistId != null) return
            val artist = appleMusicClient.findSongArtist(song.title, song.artist)
            if (artist == null) {
                logger.info("No catalog artist workId={} songId={}", event.workId, event.songId)
                return
            }
            artistService.link(song.id!!, artist.id, artist.name, artist.artworkUrl, artist.url)
        } catch (e: Exception) {
            logger.warn("Artist link failed workId={} songId={}", event.workId, event.songId, e)
        }
    }
}
