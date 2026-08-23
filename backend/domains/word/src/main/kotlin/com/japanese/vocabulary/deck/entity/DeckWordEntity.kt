package com.japanese.vocabulary.deck.entity

import jakarta.persistence.*

/**
 * deck 멤버십. flashcard 가 아니라 word 를 가리킨다 — flashcard 는 FSRS 상태만 들고 있는
 * 보조 테이블로 격하되었고, 한 word 가 여러 deck(전체 단어장 + 곡 단어장 + 일반 단어장)에 속한다.
 */
@Entity
@Table(
    name = "deck_word",
    uniqueConstraints = [UniqueConstraint(columnNames = ["deck_id", "word_id"])],
    indexes = [Index(name = "idx_deck_word_word", columnList = "word_id")],
)
class DeckWordEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "deck_id", nullable = false)
    val deckId: Long,

    @Column(name = "word_id", nullable = false)
    val wordId: Long,
)
