package com.japanese.vocabulary.song.entity

import jakarta.persistence.*
import java.time.Instant

/** 관리자가 확인한 아티스트의 공식 YouTube 채널. 채널 이름은 바뀌므로 id 로 잇는다. */
@Entity
@Table(name = "artist_youtube_channel")
class ArtistYoutubeChannelEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "artist_id", nullable = false)
    val artistId: Long,

    @Column(name = "channel_id", nullable = false)
    val channelId: String,

    @Column(name = "channel_title")
    val channelTitle: String? = null,

    @Column(name = "created_at", insertable = false, updatable = false)
    val createdAt: Instant? = null,
)
