package com.japanese.vocabulary.test.fixtures

import com.japanese.vocabulary.song.entity.SongEntity
import jakarta.persistence.EntityManager
import org.springframework.transaction.support.TransactionTemplate

class TestSongBuilder(
    private val em: EntityManager,
    private val tx: TransactionTemplate,
) {
    private var title: String = "テスト曲"
    private var artist: String = "テストアーティスト"
    private var durationSeconds: Int? = 200
    private var youtubeUrl: String? = null
    private var artworkUrl: String? = null

    fun withTitle(value: String) = apply { title = value }
    fun withArtist(value: String) = apply { artist = value }
    fun withDuration(seconds: Int?) = apply { durationSeconds = seconds }
    fun withYoutubeUrl(value: String?) = apply { youtubeUrl = value }
    fun withArtworkUrl(value: String?) = apply { artworkUrl = value }

    fun build(): SongEntity = tx.execute {
        SongEntity(
            title = title,
            artist = artist,
            durationSeconds = durationSeconds,
            youtubeUrl = youtubeUrl,
            artworkUrl = artworkUrl,
        ).also {
            em.persist(it)
            em.flush()
        }
    }!!
}
