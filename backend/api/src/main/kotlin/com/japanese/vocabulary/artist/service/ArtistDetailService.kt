package com.japanese.vocabulary.artist.service

import com.japanese.vocabulary.artist.cache.ArtistTopSongsCache
import com.japanese.vocabulary.artist.dto.ArtistDetailDto
import com.japanese.vocabulary.artist.dto.ArtistStudyingSongDto
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.song.repository.ArtistRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.songdetail.SongWordTierService
import com.japanese.vocabulary.songsearch.client.applemusic.AppleMusicClient
import com.japanese.vocabulary.songsearch.dto.SongSearchItemDto
import com.japanese.vocabulary.songsearch.dto.SongSearchResponse
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class ArtistDetailService(
    private val artistRepository: ArtistRepository,
    private val songRepository: SongRepository,
    private val deckRepository: DeckRepository,
    private val songWordTierService: SongWordTierService,
    private val appleMusicClient: AppleMusicClient,
    private val topSongsCache: ArtistTopSongsCache,
) {
    private val logger = LoggerFactory.getLogger(ArtistDetailService::class.java)

    fun detail(artistId: Long, userId: Long): ArtistDetailDto {
        val artist = artistRepository.findById(artistId).orElseThrow { BusinessException(ErrorCode.ARTIST_NOT_FOUND) }
        val songs = songRepository.findByArtistId(artistId)
        val deckSongIds = deckRepository.findByUserIdAndSongIdIn(userId, songs.map { it.id!! }).mapNotNull { it.songId }.toSet()
        val studying = songs.filter { it.id in deckSongIds }

        val studyingSongs = studying.map { song ->
            val coverage = songWordTierService.coverage(song.id!!, userId)
            ArtistStudyingSongDto(
                songId = song.id!!,
                title = song.title,
                artworkUrl = song.artworkUrl,
                totalLines = coverage.totalLines,
                knownLines = coverage.knownLines,
            )
        }.sortedByDescending { if (it.totalLines == 0) 0.0 else it.knownLines.toDouble() / it.totalLines }

        // 우리 곡은 카탈로그 표기를 그대로 들고 있어 제목·아티스트가 같으면 같은 곡이다.
        val studyingKeys = studying.map { it.title to it.artist }.toSet()
        val popularSongs = topSongs(artist.appleMusicId).filterNot { (it.title to it.artistName) in studyingKeys }

        return ArtistDetailDto(
            id = artist.id!!,
            name = artist.name,
            artworkUrl = artist.artworkUrl,
            appleMusicUrl = artist.appleMusicUrl,
            studyingSongs = studyingSongs,
            popularSongs = popularSongs,
        )
    }

    private fun topSongs(appleMusicId: String): List<SongSearchItemDto> {
        topSongsCache.get(appleMusicId)?.let { return it.items }
        return try {
            appleMusicClient.topSongs(appleMusicId).also { topSongsCache.put(appleMusicId, SongSearchResponse(it)) }
        } catch (e: Exception) {
            logger.warn("Artist top songs failed appleMusicId={}", appleMusicId, e)
            emptyList()
        }
    }
}
