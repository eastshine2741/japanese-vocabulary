package com.japanese.vocabulary.rewardcard.repository

import com.japanese.vocabulary.rewardcard.model.RewardCardKind
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

/**
 * 곡·아티스트별 "N번째 획득" 순번. 행 하나를 원자적으로 올리고 LAST_INSERT_ID 로 커넥션에 값을 받아 온다.
 * 처음 행을 넣을 때도 LAST_INSERT_ID(1) 로 값을 실어야 한다 — 이 테이블엔 auto increment 가 없어 그냥 1 을 넣으면 이전 값이 남는다.
 * 락은 카드 행과 함께 커밋까지 쥔다. 롤백되면 순번도 돌아가 빈 번호가 생기지 않는다.
 */
@Component
class RewardCardSeqAllocator(private val entityManager: EntityManager) {

    @Transactional(propagation = Propagation.MANDATORY)
    fun next(kind: RewardCardKind, targetId: Long): Int {
        entityManager.createNativeQuery(
            "INSERT INTO reward_card_seq (kind, target_id, last_seq) VALUES (:kind, :targetId, LAST_INSERT_ID(1)) " +
                "ON DUPLICATE KEY UPDATE last_seq = LAST_INSERT_ID(last_seq + 1)"
        )
            .setParameter("kind", kind.name)
            .setParameter("targetId", targetId)
            .executeUpdate()
        return (entityManager.createNativeQuery("SELECT LAST_INSERT_ID()").singleResult as Number).toInt()
    }
}
