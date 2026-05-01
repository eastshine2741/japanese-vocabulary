package com.japanese.vocabulary.test.fixtures

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.word.entity.WordEntity
import jakarta.persistence.EntityManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.Instant

/**
 * 신규(state=0, stability/difficulty=0) Flashcard 만 생성한다. 알고리즘 출력 필드(stability,
 * difficulty, due, lastReview, fsrsCardJson)의 setter는 의도적으로 노출하지 않는다 — 운영 로직
 * 복제 진입점이 되기 때문. 그런 상태가 필요한 테스트는 FlashcardMother 또는 인라인 서비스 호출로 셋업.
 */
class TestFlashcardBuilder(
    private val em: EntityManager,
    private val tx: TransactionTemplate,
    private val clock: Clock,
) {
    private var user: UserEntity? = null
    private var word: WordEntity? = null

    fun forUser(value: UserEntity) = apply { user = value }
    fun ofWord(value: WordEntity) = apply { word = value }

    fun build(): FlashcardEntity {
        val owner = user ?: TestUserBuilder(em, tx).build()
        val targetWord = word ?: TestWordBuilder(em, tx).forUser(owner).build()
        return tx.execute {
            FlashcardEntity(
                wordId = targetWord.id!!,
                userId = owner.id!!,
                due = Instant.now(clock),
            ).also {
                em.persist(it)
                em.flush()
            }
        }!!
    }
}
