package com.japanese.vocabulary.deck.entity

import jakarta.persistence.*
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant

/**
 * 단어장. 종류는 별도 enum 없이 두 컬럼 조합으로 도출한다.
 *
 * | 조건                | 종류        |
 * |---------------------|-------------|
 * | `isDefault == true` | 전체 단어장 |
 * | `songId != null`    | 곡 단어장   |
 * | 둘 다 아님          | 일반 단어장 |
 *
 * MySQL UNIQUE 가 NULL 중복을 허용한다는 점을 이용해, `UNIQUE(user_id, is_default)` 로
 * 전체 단어장 1개를 DB 가 강제하면서 일반 단어장은 여러 개 만들 수 있게 한다.
 * [songId] 는 word 도메인이 song 도메인에 갖는 유일한 물리적 FK 다.
 */
@Entity
@Table(name = "decks")
@EntityListeners(AuditingEntityListener::class)
class DeckEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "song_id")
    val songId: Long? = null,

    @Column(name = "is_default")
    val isDefault: Boolean? = null,

    @Column(name = "title", nullable = false)
    var title: String,

    @Column(name = "description", nullable = false)
    var description: String,

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    var createdAt: Instant? = null,
)
