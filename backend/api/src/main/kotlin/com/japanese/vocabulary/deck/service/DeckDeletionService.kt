package com.japanese.vocabulary.deck.service

import com.japanese.vocabulary.deck.dto.DeckDeletionPreviewResponse
import com.japanese.vocabulary.rewardcard.service.RewardCardService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 곡 단어장을 지우면 그 곡 카드도 함께 지운다. */
@Service
class DeckDeletionService(
    private val deckService: DeckService,
    private val rewardCardService: RewardCardService,
) {

    @Transactional
    fun delete(userId: Long, deckId: Long) {
        val songId = deckService.deleteDeck(userId, deckId) ?: return
        rewardCardService.removeSongCards(userId, songId)
    }

    @Transactional(readOnly = true)
    fun preview(userId: Long, deckId: Long): DeckDeletionPreviewResponse {
        val preview = deckService.getDeletionPreview(userId, deckId)
        return DeckDeletionPreviewResponse(
            deletedWordCount = preview.deletedWordCount,
            deletedCardCount = preview.songId?.let { rewardCardService.songCardCount(userId, it) } ?: 0,
        )
    }
}
