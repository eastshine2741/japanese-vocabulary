package com.japanese.vocabulary.song.repository

import com.japanese.vocabulary.song.entity.ArtistYoutubeChannelEntity
import org.springframework.data.jpa.repository.JpaRepository

interface ArtistYoutubeChannelRepository : JpaRepository<ArtistYoutubeChannelEntity, Long> {
    fun findByArtistIdOrderByIdAsc(artistId: Long): List<ArtistYoutubeChannelEntity>

    fun findByArtistIdIn(artistIds: Collection<Long>): List<ArtistYoutubeChannelEntity>

    fun findByArtistIdAndChannelId(artistId: Long, channelId: String): ArtistYoutubeChannelEntity?
}
