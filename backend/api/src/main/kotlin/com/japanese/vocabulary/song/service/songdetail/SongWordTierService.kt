package com.japanese.vocabulary.song.service.songdetail

import com.japanese.vocabulary.flashcard.model.FlashcardStudyState
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.song.dto.songdetail.SongWordTierDto
import com.japanese.vocabulary.song.dto.songdetail.SongWordTierKey
import com.japanese.vocabulary.song.dto.songdetail.SongWordTiersDto
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.word.repository.WordRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SongWordTierService(
    private val songDetailQueryService: SongDetailQueryService,
    private val lyricRepository: LyricRepository,
    private val wordRepository: WordRepository,
    private val flashcardRepository: FlashcardRepository,
) {
    /**
     * 단계는 "전체 담기" 와 같은 단어 집합(기본 필터 통과분)을 나눈다. 필터 밖 단어(대명사·접속사 등)는
     * 어느 단계에도 없다 — 단어 탭에서 개별로 담는 길은 그대로다.
     */
    @Transactional(readOnly = true)
    fun tiers(songId: Long, userId: Long): SongWordTiersDto {
        val words = songDetailQueryService.words(songId, userId)
        val eligible = with(songDetailQueryService) { words.words.filter { it.matchesDefaultFilters() } }
        // words() 가 곡·가사 존재를 이미 검증했다.
        val rawLines = lyricRepository.findActiveBySongId(songId)?.rawContent.orEmpty()
        val classified = SongWordTierClassifier.classify(eligible, rawLines)

        // 복습 상태는 유저의 단어 기준이다. 다른 곡에서 담아 익힌 단어도 이 곡에서 아는 단어다.
        val savedWords = wordRepository.findByUserIdAndJapaneseTextIn(userId, eligible.map { it.japanese })
        val wordIdByJapanese = savedWords.associate { it.japaneseText to it.id!! }
        val stateByWordId = flashcardRepository.findByUserIdAndWordIdIn(userId, wordIdByJapanese.values)
            .associate { it.wordId to FlashcardStudyState.of(it) }

        val tiers = SongWordTierKey.entries.sortedBy { it.order }.map { key ->
            val tierWords = classified[key].orEmpty()
            val states = tierWords.mapNotNull { word -> wordIdByJapanese[word.japanese]?.let { stateByWordId[it] } }
            SongWordTierDto(
                key = key,
                order = key.order,
                name = key.displayName,
                description = key.description,
                wordJapanese = tierWords.map { it.japanese },
                totalCount = tierWords.size,
                knownCount = states.count { it == FlashcardStudyState.MASTERED },
                learningCount = states.count { it == FlashcardStudyState.STUDYING },
            )
        }
        return SongWordTiersDto(songId = songId, tiers = tiers)
    }
}
