package com.japanese.vocabulary.word.service.songword

import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.word.model.SongTierCards
import com.japanese.vocabulary.word.model.SongWordTierKey
import com.japanese.vocabulary.word.repository.WordRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SongTierCardService(
    private val songWordQueryService: SongWordQueryService,
    private val wordRepository: WordRepository,
    private val flashcardRepository: FlashcardRepository,
) {
    /**
     * 보상 카드가 단계 진행·기억 확률을 잴 때 쓴다. 곡마다 단계별 tier 단어와 그 유저의 flashcard 를 순서대로 준다.
     * 곡 수와 상관없이 유저 단어·flashcard 를 한 번씩만 조회한다. 키는 곡 id 다.
     */
    @Transactional(readOnly = true)
    fun tierCards(userId: Long, lyrics: Collection<LyricEntity>): Map<Long, SongTierCards> = with(songWordQueryService) {
        if (lyrics.isEmpty()) return emptyMap()
        val keys = lyrics.flatMap { wordKeys(it) }.distinct()
        val savedWords = if (keys.isEmpty()) emptyMap() else {
            wordRepository.findByUserIdAndJapaneseTextIn(userId, keys).associateBy { it.japaneseText }
        }
        val songs = lyrics.associate { lyric ->
            val words = assembleWords(lyric, savedWords)
            lyric.songId to (words to SongWordTierClassifier.classifyCurrent(words.words.filter { it.isTierWord() }, lyric.rawContent))
        }
        val tierWordIds = songs.values
            .flatMap { (_, tiers) -> tiers.values.flatten() }
            .flatMap { listOf(it.addRequest.japanese, it.japanese) }
            .mapNotNull { savedWords[it]?.id }
            .distinct()
        val cardByWordId = if (tierWordIds.isEmpty()) emptyMap() else {
            flashcardRepository.findByUserIdAndWordIdIn(userId, tierWordIds).associateBy { it.wordId }
        }
        val cardByJapanese = savedWords.mapNotNull { (japanese, word) -> cardByWordId[word.id]?.let { japanese to it } }.toMap()
        songs.mapValues { (_, song) ->
            val (words, tiers) = song
            SongTierCards(
                words = words,
                // 복습 상태는 유저의 단어 기준이다. 다른 곡에서 담아 익힌 단어도 이 곡에서 아는 단어다.
                tiers = SongWordTierKey.current.associateWith { key ->
                    tiers[key].orEmpty().map { it to (cardByJapanese[it.addRequest.japanese] ?: cardByJapanese[it.japanese]) }
                },
            )
        }
    }
}
