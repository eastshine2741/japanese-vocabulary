package com.japanese.vocabulary.flashcard.model

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity

/**
 * 단어장 통계가 카드를 세는 세 칸. `state` 는 FSRS `State.ordinal` (0 LEARNING, 1 REVIEW, 2 RELEARNING).
 * [com.japanese.vocabulary.deck.repository.DeckRepository] 의 통계 SQL(masteredCount/studyingCount/newWordCount)과
 * 같은 판정이어야 한다 — 한쪽을 바꾸면 다른 쪽도 바꿀 것.
 */
enum class FlashcardStudyState {
    NEW, STUDYING, MASTERED;

    companion object {
        fun of(card: FlashcardEntity): FlashcardStudyState = when {
            card.state == 1 -> MASTERED
            card.state == 2 || card.lastReview != null -> STUDYING
            else -> NEW
        }
    }
}
