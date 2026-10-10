package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.rewardcard.dto.RewardCardRevealDto
import com.japanese.vocabulary.rewardcard.dto.SongAchievementDto
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.songdetail.SongWordTierService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

/**
 * rating 직후 같은 트랜잭션에서, 그 단어가 담긴 곡 단어장의 곡들 카드 등급을 다시 잰다.
 * 곡 수와 상관없이 곡·가사·유저 단어·flashcard 를 한 번씩만 조회하고, 등급 계산은 메모리에서 한다.
 */
@Service
class RewardCardAchievementService(
    private val deckRepository: DeckRepository,
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
    private val songWordTierService: SongWordTierService,
    private val rewardCardService: RewardCardService,
) {
    @Transactional(propagation = Propagation.MANDATORY)
    fun onReviewed(userId: Long, wordId: Long): List<RewardCardRevealDto> {
        val songIds = deckRepository.findSongIdsContainingWord(userId, wordId).toSet()
        if (songIds.isEmpty()) return emptyList()
        val grades = rewardCardService.songGrades(userId, songIds)
        val targets = songIds.filter { grades[it] != SongCardGrade.MASTER }
        if (targets.isEmpty()) return emptyList()

        // 곡·활성 가사가 없는 곡은 조회에서 빠질 뿐 던지지 않는다 — 던지면 공유 트랜잭션이 rollback-only 가 되어 rating 까지 무너진다.
        val artistIds = songRepository.findAllById(targets).associate { it.id!! to it.artistId }
        val lyrics = lyricRepository.findActiveBySongIdIn(targets).filter { it.songId in artistIds }
        val achievements = songWordTierService.tierCards(userId, lyrics).map { (songId, cards) ->
            SongAchievementDto(
                songId = songId,
                artistId = artistIds[songId],
                grade = SongCardGradeRule.of(cards.tiers.values.map { tier -> tier.map { it.second } }),
            )
        }
        return rewardCardService.achieveSongs(userId, achievements)
    }
}
