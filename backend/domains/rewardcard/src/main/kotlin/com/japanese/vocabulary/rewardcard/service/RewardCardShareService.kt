package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.rewardcard.dto.RewardCardRefDto
import com.japanese.vocabulary.rewardcard.model.RewardCardKind
import com.japanese.vocabulary.rewardcard.repository.ArtistCardRepository
import com.japanese.vocabulary.rewardcard.repository.SongCardRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 공유는 발급된 카드만 가리킨다. 링크는 카드 id 를 서명해 만들므로 따로 저장하지 않는다. */
@Service
class RewardCardShareService(
    private val songCardRepository: SongCardRepository,
    private val artistCardRepository: ArtistCardRepository,
) {
    /** 발급 전이거나 남의 카드면 없는 카드와 똑같이 답한다. */
    @Transactional(readOnly = true)
    fun issuedCard(userId: Long, kind: RewardCardKind, targetId: Long): RewardCardRefDto {
        val ref = when (kind) {
            RewardCardKind.SONG -> songCardRepository.findByUserIdAndSongId(userId, targetId)
                ?.takeIf { it.isIssued }?.let { RewardCardRefDto(kind, it.id!!, it.userId, it.songId) }
            RewardCardKind.ARTIST -> artistCardRepository.findByUserIdAndArtistId(userId, targetId)
                ?.takeIf { it.isIssued }?.let { RewardCardRefDto(kind, it.id!!, it.userId, it.artistId) }
        }
        return ref ?: throw BusinessException(ErrorCode.REWARD_CARD_NOT_FOUND)
    }

    @Transactional(readOnly = true)
    fun findIssuedCard(kind: RewardCardKind, cardId: Long): RewardCardRefDto? = when (kind) {
        RewardCardKind.SONG -> songCardRepository.findById(cardId).orElse(null)
            ?.takeIf { it.isIssued }?.let { RewardCardRefDto(kind, it.id!!, it.userId, it.songId) }
        RewardCardKind.ARTIST -> artistCardRepository.findById(cardId).orElse(null)
            ?.takeIf { it.isIssued }?.let { RewardCardRefDto(kind, it.id!!, it.userId, it.artistId) }
    }
}
