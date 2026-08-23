package com.japanese.vocabulary.word.service

import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.dto.SenseExampleDto
import com.japanese.vocabulary.word.dto.WordSenseDto
import com.japanese.vocabulary.word.model.WordSense

/**
 * `words.senses` JSON 은 곡 id 만 들고 있다. 응답에 곡 제목/아트워크를 붙이려면 별도 조회가 필요한데,
 * word · flashcard 양쪽에서 같은 조립이 필요하므로 여기로 모은다.
 */
object SenseEnricher {

    /** 곡 엔티티를 모듈 밖으로 넘기지 않기 위한 최소 투영. */
    data class SongMeta(val title: String, val artworkUrl: String?)

    fun loadSongs(senses: List<WordSense>, songRepository: SongRepository): Map<Long, SongMeta> {
        val songIds = senses.flatMap { it.examples }.mapNotNull { it.songId }.toSet()
        if (songIds.isEmpty()) return emptyMap()
        return songRepository.findAllById(songIds)
            .associate { it.id!! to SongMeta(title = it.title, artworkUrl = it.artworkUrl) }
    }

    fun List<WordSense>.toDtos(songRepository: SongRepository): List<WordSenseDto> =
        toDtos(loadSongs(this, songRepository))

    fun List<WordSense>.toDtos(songs: Map<Long, SongMeta>): List<WordSenseDto> = map { sense ->
        WordSenseDto(
            meaning = sense.meaning,
            partOfSpeech = sense.partOfSpeech,
            jlpt = sense.jlpt,
            examples = sense.examples.map { example ->
                val song = example.songId?.let { songs[it] }
                SenseExampleDto(
                    text = example.text,
                    translation = example.translation,
                    songId = example.songId,
                    lineIndex = example.lineIndex,
                    songTitle = song?.title,
                    artworkUrl = song?.artworkUrl,
                )
            },
        )
    }
}
