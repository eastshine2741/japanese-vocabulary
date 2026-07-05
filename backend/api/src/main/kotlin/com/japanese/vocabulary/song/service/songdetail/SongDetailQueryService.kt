package com.japanese.vocabulary.song.service.songdetail

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.dto.SongDto
import com.japanese.vocabulary.song.dto.songdetail.*
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.model.WordCandidate
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.word.dto.AddWordRequest
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SongDetailQueryService(
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
    private val wordRepository: WordRepository,
    private val songWordRepository: SongWordRepository,
) {
    @Transactional(readOnly = true)
    fun metadata(songId: Long): SongDto {
        val song = songRepository.findById(songId).orElseThrow { BusinessException(ErrorCode.SONG_NOT_FOUND) }
        val lyric = lyricRepository.findActiveBySongId(songId)
        return SongDto(
            id = song.id!!,
            title = song.title,
            artist = song.artist,
            durationSeconds = song.durationSeconds,
            artworkUrl = song.artworkUrl,
            youtubeUrl = song.youtubeUrl,
            lyricType = lyric?.lyricType ?: LyricType.PLAIN,
        )
    }

    @Transactional(readOnly = true)
    fun lyrics(songId: Long): SongLyricsDto {
        songRepository.findById(songId).orElseThrow { BusinessException(ErrorCode.SONG_NOT_FOUND) }
        val lyric = lyricRepository.findActiveBySongId(songId) ?: throw BusinessException(ErrorCode.LYRIC_NOT_FOUND)
        val analyzedByIndex = lyric.analyzedContent.orEmpty().associateBy { it.index }
        val source = lyric.source()
        return SongLyricsDto(
            lyricId = lyric.id!!,
            lyricsSourceName = source.name,
            lyricsSourceUrl = source.url,
            lines = lyric.rawContent.sortedBy { it.index }.map { raw ->
                val analyzed = analyzedByIndex[raw.index]
                SongLyricLineDto(
                    index = raw.index,
                    originalText = raw.text,
                    startTimeMs = raw.startTimeMs,
                    koreanLyrics = analyzed?.koreanLyrics,
                    koreanPronounciation = analyzed?.koreanPronounciation,
                    tokens = analyzed?.tokens ?: emptyList(),
                )
            },
        )
    }

    @Transactional(readOnly = true)
    fun words(songId: Long, userId: Long): WordsInSongDto {
        songRepository.findById(songId).orElseThrow { BusinessException(ErrorCode.SONG_NOT_FOUND) }
        val lyric = lyricRepository.findActiveBySongId(songId) ?: throw BusinessException(ErrorCode.LYRIC_NOT_FOUND)
        val emptyDefaults = WordFilterDefaultsDto()
        val wordCandidates = lyric.wordCandidates
        if (wordCandidates == null) {
            return WordsInSongDto(
                lyricId = lyric.id!!,
                wordSummary = WordSummaryDto(jlptDistribution = emptyJlptDistribution()),
                filterDefaults = emptyDefaults,
                words = emptyList(),
                lineWordIndexes = emptyMap(),
            )
        }

        val sorted = wordCandidates.candidates.sortedWith(compareByDescending<WordCandidate> { it.importanceScore }.thenBy { it.appearanceOrder }.thenBy { it.japanese })
        val wordsByJapanese = wordRepository.findByUserIdAndJapaneseTextIn(userId, sorted.map { it.japanese }.distinct()).associateBy { it.japaneseText }
        val songWordsByWordId = songWordRepository.findBySongIdAndWordIdIn(songId, wordsByJapanese.values.mapNotNull { it.id }).associateBy { it.wordId }
        val rawToFinalIndex = sorted.mapIndexed { finalIndex, candidate -> wordCandidates.candidates.indexOf(candidate) to finalIndex }.toMap()
        val analyzedByIndex = lyric.analyzedContent.orEmpty().associateBy { it.index }
        val rawByIndex = lyric.rawContent.associateBy { it.index }
        val items = sorted.map { candidate ->
            val saved = wordsByJapanese[candidate.japanese]
            val songWord = saved?.id?.let { songWordsByWordId[it] }
            val lineIndex = candidate.lineIndexes.sorted().firstOrNull()
            WordInSongItemDto(
                japanese = candidate.japanese,
                surface = candidate.surface,
                baseForm = candidate.baseForm,
                reading = candidate.baseFormReading ?: candidate.reading,
                koreanText = candidate.koreanText,
                partOfSpeech = candidate.partOfSpeech,
                partOfSpeechLabel = candidate.partOfSpeechLabel,
                jlpt = candidate.jlpt,
                importanceScore = candidate.importanceScore,
                appearanceOrder = candidate.appearanceOrder,
                frequency = candidate.frequency,
                lineIndexes = candidate.lineIndexes,
                isSavedGlobally = saved != null,
                isSavedForSong = songWord != null,
                savedWordId = songWord?.let { saved.id },
                addRequest = AddWordRequest(
                    japanese = candidate.baseForm?.takeIf { it.isNotBlank() } ?: candidate.surface,
                    reading = candidate.baseFormReading ?: candidate.reading ?: "",
                    koreanText = candidate.koreanText ?: "",
                    partOfSpeech = candidate.partOfSpeech,
                    songId = songId,
                    lyricLine = lineIndex?.let { rawByIndex[it]?.text } ?: "",
                    koreanLyricLine = lineIndex?.let { analyzedByIndex[it]?.koreanLyrics },
                ),
            )
        }
        val lineWordIndexes = wordCandidates.lineCandidates.mapKeys { it.key.toInt() }.mapValues { (_, rawIndexes) -> rawIndexes.mapNotNull { rawToFinalIndex[it] } }
        val defaultBulkAddCount = items.count { it.matchesDefaultFilters() && !it.isSavedForSong }
        return WordsInSongDto(
            lyricId = lyric.id!!,
            wordSummary = WordSummaryDto(
                topWords = items.take(5).map { WordSummaryItemDto(it.japanese, it.reading, it.koreanText, it.jlpt, it.importanceScore) },
                jlptDistribution = emptyJlptDistribution() + items.groupingBy { it.jlpt?.takeIf(String::isNotBlank) ?: "UNKNOWN" }.eachCount(),
                totalCandidateCount = items.size,
                defaultBulkAddCount = defaultBulkAddCount,
            ),
            filterDefaults = emptyDefaults,
            words = items,
            lineWordIndexes = lineWordIndexes,
        )
    }

    private fun WordInSongItemDto.matchesDefaultFilters(): Boolean =
        partOfSpeech in WordFilterDefaultsDto().pos && jlpt in WordFilterDefaultsDto().jlpt

    private fun emptyJlptDistribution() = linkedMapOf("N1" to 0, "N2" to 0, "N3" to 0, "N4" to 0, "N5" to 0, "UNKNOWN" to 0)

    private data class LyricsSource(val name: String?, val url: String?)
    private fun LyricEntity.source() = when {
        vocadbId != null -> LyricsSource("VocaDB", "https://vocadb.net/S/$vocadbId")
        lrclibId != null -> LyricsSource("LRCLIB", "https://lrclib.net")
        else -> LyricsSource(null, null)
    }
}
