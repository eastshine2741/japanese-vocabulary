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
import com.japanese.vocabulary.word.model.SenseExample
import com.japanese.vocabulary.word.model.WordSense
import com.japanese.vocabulary.word.model.splitMeanings
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

    // 구 데이터의 한글 독음을 그대로 내려보낸다. 아직 재분석되지 않은 곡은 그것 말고 독음이 없다.
    @Suppress("DEPRECATION")
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
                    pronounciation = analyzed?.pronounciation,
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
            // candidate 하나가 뜻 하나다. 각 sense 는 자기 품사·JLPT 와, 자기가 등장한 가사 줄로 만든 예문을 갖는다.
            val candidateSenses = candidates.mapNotNull { item ->
                item.koreanText
                    ?.takeIf { it.isNotBlank() }
                    ?.let { meaning ->
                        WordSense(
                            meaning = meaning,
                            partOfSpeech = item.partOfSpeech,
                            jlpt = item.jlpt,
                            examples = item.lineIndexes.distinct().sorted().map { line ->
                                SenseExample(
                                    text = rawByIndex[line]?.text ?: "",
                                    translation = analyzedByIndex[line]?.koreanLyrics,
                                    songId = songId,
                                    lineIndex = line,
                                )
                            },
                        )
                    }
            }
            // 분석이 준 뜻은 "사랑, 애정" 처럼 쉼표로 이어진 문자열 하나다. 조각마다 별개의 sense 로
            // 쪼개야 담을 때도, 담겼는지 판정할 때도 뜻 단위가 된다. 예문은 첫 조각만 갖는다.
            // 같은 뜻이 여러 candidate 에서 나오면 하나로 합친다 — 예문을 가진 쪽이 버려지면 안 된다.
            val mergedSenses = candidateSenses.splitMeanings()
                .groupBy { it.meaning }
                .map { (_, sameMeaning) ->
                    sameMeaning.first().copy(examples = sameMeaning.flatMap { it.examples }.distinct())
                }
            // 한 가사 줄은 뜻 하나에만 붙는다. 그 줄이 어느 뜻으로 쓰였는지 모르는 채 여러 뜻에
            // 복제하면 예문 목록에 같은 줄이 뜻 수만큼 반복되고, sense 당 예문 상한도 그 중복이 먹는다.
            val claimedLines = mutableSetOf<Int?>()
            val senses = mergedSenses.map { sense ->
                sense.copy(examples = sense.examples.filter { claimedLines.add(it.lineIndex) })
            }
            val lineIndexes = candidates.flatMap { it.lineIndexes }.distinct().sorted()
            val saved = wordsByJapanese[candidate.japanese]
            // ALL 판정: 곡이 제시한 뜻이 전부 저장돼 있어야 담긴 것으로 본다. 비교는 이미 로드한 senses 로 메모리에서.
            val savedWithMeaning = saved != null &&
                senses.isNotEmpty() &&
                senses.all { required -> saved.senses.any { it.meaning == required.meaning } }
            val savedWordId = saved?.id?.takeIf { savedWithMeaning }
            // 요약 표시용 뜻은 쪼개기 전 문자열이다 — 조각 하나만 보여주면 뜻이 잘려 보인다.
            val primaryMeaning = candidateSenses.firstOrNull()?.meaning ?: candidate.koreanText
            WordInSongItemDto(
                japanese = candidate.japanese,
                surface = candidate.surface,
                baseForm = candidate.baseForm,
                reading = candidate.baseFormReading ?: candidate.reading,
                koreanText = primaryMeaning,
                senses = senses,
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
                    reading = candidate.baseFormReading ?: candidate.reading,
                    senses = senses,
                    songId = songId,
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
