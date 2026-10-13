package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.rewardcard.dto.RewardCardRevealDto
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

/** rating 직후 같은 트랜잭션에서, 그 단어가 담긴 곡 단어장의 곡들 등급을 다시 재서 새로 닿은 등급의 카드를 만든다. */
@Service
class RewardCardAchievementService(
    private val deckRepository: DeckRepository,
    private val songCardGrader: SongCardGrader,
    private val rewardCardService: RewardCardService,
) {
    @Transactional(propagation = Propagation.MANDATORY)
    fun onReviewed(userId: Long, wordId: Long): List<RewardCardRevealDto> {
        val songIds = deckRepository.findSongIdsContainingWord(userId, wordId).toSet()
        if (songIds.isEmpty()) return emptyList()
        val owned = rewardCardService.ownedSongGrades(userId, songIds)
        val targets = songIds.filter { SongCardGrade.MASTER !in owned[it].orEmpty() }
        if (targets.isEmpty()) return emptyList()
        return rewardCardService.achieveSongs(userId, songCardGrader.measure(userId, targets))
    }
}
