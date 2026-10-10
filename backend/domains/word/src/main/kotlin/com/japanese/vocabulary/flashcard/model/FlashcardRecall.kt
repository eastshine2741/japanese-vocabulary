package com.japanese.vocabulary.flashcard.model

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import io.github.openspacedrepetition.Card
import io.github.openspacedrepetition.Scheduler
import java.time.Instant

/** 지금 떠올릴 FSRS 확률(retrievability). 리뷰 이력이 없는 카드는 0 이다. */
object FlashcardRecall {
    private val SCHEDULER: Scheduler = Scheduler.builder().desiredRetention(0.9).build()

    fun of(card: FlashcardEntity, at: Instant): Double =
        SCHEDULER.getCardRetrievability(Card.fromJson(card.fsrsCardJson), at)
}
