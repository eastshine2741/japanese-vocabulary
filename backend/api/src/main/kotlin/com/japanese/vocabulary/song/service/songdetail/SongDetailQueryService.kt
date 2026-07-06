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
import com.japanese.vocabulary.word.dto.AddWordExampleRequest
import com.japanese.vocabulary.word.dto.AddWordRequest
import com.japanese.vocabulary.word.model.WordMeaning
import com.japanese.vocabulary.word.repository.WordRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SongDetailQueryService(
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
    private val wordRepository: WordRepository,
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

        val sorted = wordCandidates.candidates.withIndex().sortedWith(
            compareByDescending<IndexedValue<WordCandidate>> { it.value.importanceScore }
                .thenBy { it.value.appearanceOrder }
                .thenBy { it.value.japanese }
        )
        val grouped = sorted.groupBy { it.value.japanese }.values.toList()
        val wordsByJapanese = wordRepository.findByUserIdAndJapaneseTextIn(
            userId,
            grouped.map { it.first().value.japanese }.distinct()
        ).associateBy { it.japaneseText }
        val rawToFinalIndex = grouped.flatMapIndexed { finalIndex, group ->
            group.map { it.index to finalIndex }
        }.toMap()
        val analyzedByIndex = lyric.analyzedContent.orEmpty().associateBy { it.index }
        val rawByIndex = lyric.rawContent.associateBy { it.index }
        val items = grouped.map { group ->
            val candidates = group.map { it.value }
            val candidate = candidates.first()
            val meanings = candidates.mapNotNull { item ->
                item.koreanText
                    ?.takeIf { it.isNotBlank() }
                    ?.let { WordMeaning(text = it, partOfSpeech = item.partOfSpeech) }
            }.distinctBy { it.text }
            val lineIndexes = candidates.flatMap { it.lineIndexes }.distinct().sorted()
            val examples = lineIndexes.map { lineIndex ->
                AddWordExampleRequest(
                    songId = songId,
                    lyricLine = rawByIndex[lineIndex]?.text ?: "",
                    koreanLyricLine = analyzedByIndex[lineIndex]?.koreanLyrics,
                )
            }
            val saved = wordsByJapanese[candidate.japanese]
            val savedWithMeaning = saved != null &&
                meanings.isNotEmpty() &&
                meanings.all { required -> saved.meanings.any { it.text == required.text } }
            val savedWordId = saved?.id?.takeIf { savedWithMeaning }
            val lineIndex = lineIndexes.firstOrNull()
            val primaryMeaning = meanings.firstOrNull()?.text ?: candidate.koreanText
            WordInSongItemDto(
                japanese = candidate.japanese,
                surface = candidate.surface,
                baseForm = candidate.baseForm,
                reading = candidate.baseFormReading ?: candidate.reading,
                koreanText = primaryMeaning,
                meanings = meanings,
                partOfSpeech = candidate.partOfSpeech,
                partOfSpeechLabel = candidate.partOfSpeechLabel,
                jlpt = candidate.jlpt,
                importanceScore = candidate.importanceScore,
                appearanceOrder = candidate.appearanceOrder,
                frequency = lineIndexes.size,
                lineIndexes = lineIndexes,
                isSavedGlobally = saved != null,
                isSavedForSong = savedWithMeaning,
                savedWordId = savedWordId,
                addRequest = AddWordRequest(
                    japanese = candidate.baseForm?.takeIf { it.isNotBlank() } ?: candidate.surface,
                    reading = candidate.baseFormReading ?: candidate.reading ?: "",
                    koreanText = primaryMeaning ?: "",
                    partOfSpeech = candidate.partOfSpeech,
                    songId = songId,
                    lyricLine = lineIndex?.let { rawByIndex[it]?.text } ?: "",
                    koreanLyricLine = lineIndex?.let { analyzedByIndex[it]?.koreanLyrics },
                    meanings = meanings,
                    examples = examples,
                ),
            )
        }
        val lineWordIndexes = wordCandidates.lineCandidates.mapKeys { it.key.toInt() }.mapValues { (_, rawIndexes) ->
            rawIndexes.mapNotNull { rawToFinalIndex[it] }.distinct()
        }
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
