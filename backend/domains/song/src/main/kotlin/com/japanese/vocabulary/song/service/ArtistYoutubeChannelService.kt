package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.common.text.ArtistCredit
import com.japanese.vocabulary.song.entity.ArtistYoutubeChannelEntity
import com.japanese.vocabulary.song.repository.ArtistRepository
import com.japanese.vocabulary.song.repository.ArtistYoutubeChannelRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ArtistYoutubeChannelService(
    private val channelRepository: ArtistYoutubeChannelRepository,
    private val artistRepository: ArtistRepository,
    private val songRepository: SongRepository,
) {
    /**
     * Official channels of a song's artist, for the MV search. A song analysed for the first time is not linked to its
     * catalog artist yet (that happens after completion), so the credit's names are matched against artist names too.
     */
    @Transactional(readOnly = true)
    fun officialChannelIds(songId: Long?, rawArtist: String): Set<String> {
        val linked = songId?.let { songRepository.findById(it).orElse(null)?.artistId }
        val credit = ArtistCredit.withoutFeaturing(rawArtist)
        val names = (listOf(rawArtist, credit) + ArtistCredit.names(rawArtist)).map { it.trim() }.filter { it.isNotEmpty() }.distinct()
        val artistIds = artistRepository.findByNameIn(names).mapNotNull { it.id } + listOfNotNull(linked)
        if (artistIds.isEmpty()) return emptySet()
        return channelRepository.findByArtistIdIn(artistIds.distinct()).map { it.channelId }.toSet()
    }

    @Transactional(readOnly = true)
    fun list(artistId: Long): List<ArtistYoutubeChannelEntity> = channelRepository.findByArtistIdOrderByIdAsc(artistId)

    @Transactional
    fun add(artistId: Long, channel: String, channelTitle: String?): ArtistYoutubeChannelEntity {
        if (!artistRepository.existsById(artistId)) throw BusinessException(ErrorCode.ARTIST_NOT_FOUND)
        val channelId = parseChannelId(channel) ?: throw BusinessException(ErrorCode.YOUTUBE_CHANNEL_ID_INVALID)
        if (channelRepository.findByArtistIdAndChannelId(artistId, channelId) != null) {
            throw BusinessException(ErrorCode.ARTIST_YOUTUBE_CHANNEL_ALREADY_EXISTS)
        }
        return channelRepository.save(
            ArtistYoutubeChannelEntity(artistId = artistId, channelId = channelId, channelTitle = channelTitle?.trim()?.takeIf { it.isNotEmpty() }),
        )
    }

    @Transactional
    fun remove(artistId: Long, channelId: String) {
        val row = channelRepository.findByArtistIdAndChannelId(artistId, channelId)
            ?: throw BusinessException(ErrorCode.ARTIST_YOUTUBE_CHANNEL_NOT_FOUND)
        channelRepository.delete(row)
    }

    companion object {
        // @handle and /c/ URLs need a YouTube lookup to become an id; the id is on the channel's About page.
        private val CHANNEL_ID = Regex("""(UC[A-Za-z0-9_-]{22})""")

        fun parseChannelId(value: String): String? {
            val trimmed = value.trim()
            if (CHANNEL_ID.matches(trimmed)) return trimmed
            return Regex("""/channel/(UC[A-Za-z0-9_-]{22})""").find(trimmed)?.groupValues?.get(1)
        }
    }
}
