package com.japanese.vocabulary.song.dto.songdetail

import com.japanese.vocabulary.flashcard.dto.FlashcardDto
import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import com.japanese.vocabulary.word.dto.WordSenseDto

/**
 * 곡 학습 세션의 카드 한 장. 아직 담지 않은 단어도 카드로 보여 주고, rating 을 줄 때에야 담는다.
 * [inSongDeck] 이 false 면 `POST /api/songs/{id}/words/review` 로 담으면서 리뷰하고, true 면
 * 보통 리뷰(`POST /api/flashcards/{id}/review`)를 쓴다. 다른 곡에서 담은 단어는 [id] 가 있어도 false 다.
 */
data class SongStudyCardDto(
    /** 아직 담지 않은 단어면 null. */
    val id: Long?,
    val wordId: Long?,
    val japanese: String,
    val reading: String?,
    val senses: List<WordSenseDto>,
    val state: Int,
    val due: String,
    val intervals: Map<Int, String>?,
    val memory: FlashcardMemory,
    val inSongDeck: Boolean,
) {
    companion object {
        fun of(card: FlashcardDto, inSongDeck: Boolean) = SongStudyCardDto(
            id = card.id,
            wordId = card.wordId,
            japanese = card.japanese,
            reading = card.reading,
            senses = card.senses,
            state = card.state,
            due = card.due,
            intervals = card.intervals,
            memory = card.memory,
            inSongDeck = inSongDeck,
        )
    }
}
