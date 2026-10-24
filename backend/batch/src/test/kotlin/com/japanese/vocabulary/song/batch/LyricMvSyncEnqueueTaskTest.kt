package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricMvSyncEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.DefaultApplicationArguments

class LyricMvSyncEnqueueTaskTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var task: LyricMvSyncEnqueueTask

    @Test
    fun `queues the current lyric and MV of songs missing from the queue and keeps existing rows`() {
        val missing = songWithLyric("https://www.youtube.com/watch?v=aaaaaaaaaaa")
        val queued = songWithLyric("https://www.youtube.com/watch?v=bbbbbbbbbbb")
        songWithLyric(null)
        entityManager.persist(LyricMvSyncEntity(lyricId = queued.activeLyricId!!, youtubeVideoId = "bbbbbbbbbbb", attempt = 2))
        entityManager.flush()

        task.run(DefaultApplicationArguments())
        entityManager.clear()

        val rows = entityManager.createQuery("SELECT s FROM LyricMvSyncEntity s", LyricMvSyncEntity::class.java).resultList
        assertThat(rows.map { it.lyricId to it.youtubeVideoId })
            .containsExactlyInAnyOrder(missing.activeLyricId!! to "aaaaaaaaaaa", queued.activeLyricId!! to "bbbbbbbbbbb")
        assertThat(rows.single { it.lyricId == queued.activeLyricId }.attempt).isEqualTo(2)
    }

    private fun songWithLyric(youtubeUrl: String?): SongEntity {
        val song = TestSongBuilder(entityManager).withYoutubeUrl(youtubeUrl).build()
        val lyric = LyricEntity(
            songId = song.id!!,
            lyricType = LyricType.PLAIN,
            rawContent = listOf(LyricLineData(index = 0, startTimeMs = null, text = "夢")),
        )
        entityManager.persist(lyric)
        song.activeLyricId = lyric.id
        entityManager.flush()
        return song
    }
}
