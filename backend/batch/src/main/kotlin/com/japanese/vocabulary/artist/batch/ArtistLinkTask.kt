package com.japanese.vocabulary.artist.batch

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.ArtistService
import com.japanese.vocabulary.songsearch.client.applemusic.AppleMusicClient
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Component

/**
 * 아티스트가 비어 있는 곡을 Apple Music 에서 찾아 잇는다. 분석 완료 때 worker 가 잇지 못한 곡과 기존 곡을 맡는다.
 * 카탈로그에 없는 곡은 매번 다시 찾지만, 곡 하나에 검색 한 번이라 남겨 둔다.
 */
@Component
class ArtistLinkTask(
    private val songRepository: SongRepository,
    private val appleMusicClient: AppleMusicClient,
    private val artistService: ArtistService,
) : CronTask {
    private val logger = LoggerFactory.getLogger(ArtistLinkTask::class.java)

    override val name = NAME

    override fun run(args: ApplicationArguments) {
        var lastId = 0L
        var linked = 0
        var missing = 0
        var failed = 0
        while (true) {
            val songs = songRepository.findByArtistIdIsNullAndIdGreaterThanOrderByIdAsc(lastId, PageRequest.of(0, PAGE_SIZE))
            if (songs.isEmpty()) break
            for (song in songs) {
                try {
                    val artist = appleMusicClient.findSongArtist(song.title, song.artist)
                    if (artist == null) {
                        missing++
                    } else {
                        artistService.link(song.id!!, artist.id, artist.name, artist.artworkUrl, artist.url)
                        linked++
                    }
                } catch (e: Exception) {
                    failed++
                    logger.warn("Artist link failed songId={}", song.id, e)
                }
            }
            lastId = songs.last().id!!
        }
        logger.info("artistLink linked={} missing={} failed={}", linked, missing, failed)
        check(failed == 0) { "artist link failed for $failed songs" }
    }

    companion object {
        const val NAME = "artist-link"
        private const val PAGE_SIZE = 100
    }
}
