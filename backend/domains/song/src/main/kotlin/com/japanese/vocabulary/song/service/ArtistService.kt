package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.repository.ArtistRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

@Service
class ArtistService(
    private val artistRepository: ArtistRepository,
    private val songRepository: SongRepository,
) {
    /**
     * 카탈로그 아티스트를 만들거나 갱신하고 곡을 잇는다. 같은 곡을 다시 이어도 결과가 같다.
     * 분석 완료 AFTER_COMMIT 리스너가 부르므로, 끝난 트랜잭션에 합류하지 않게 새로 연다.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun link(songId: Long, appleMusicId: String, name: String, artworkUrl: String?, appleMusicUrl: String?): Long {
        artistRepository.upsert(appleMusicId, name, artworkUrl, appleMusicUrl)
        val artistId = checkNotNull(artistRepository.findByAppleMusicId(appleMusicId)?.id)
        songRepository.updateArtistId(songId, artistId)
        return artistId
    }
}
