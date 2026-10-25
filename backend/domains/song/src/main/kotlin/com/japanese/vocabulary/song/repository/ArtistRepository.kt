package com.japanese.vocabulary.song.repository

import com.japanese.vocabulary.song.entity.ArtistEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface ArtistRepository : JpaRepository<ArtistEntity, Long> {
    fun findByAppleMusicId(appleMusicId: String): ArtistEntity?

    /** worker 가 같은 아티스트의 두 곡을 동시에 이을 수 있어 unique 키로 합친다. 사진·이름은 최신으로 덮는다. */
    @Modifying
    @Query(
        value = """
            INSERT INTO artist (apple_music_id, name, artwork_url, apple_music_url)
            VALUES (:appleMusicId, :name, :artworkUrl, :appleMusicUrl)
            ON DUPLICATE KEY UPDATE name = VALUES(name), artwork_url = VALUES(artwork_url), apple_music_url = VALUES(apple_music_url)
        """,
        nativeQuery = true,
    )
    fun upsert(
        @Param("appleMusicId") appleMusicId: String,
        @Param("name") name: String,
        @Param("artworkUrl") artworkUrl: String?,
        @Param("appleMusicUrl") appleMusicUrl: String?,
    ): Int
}
