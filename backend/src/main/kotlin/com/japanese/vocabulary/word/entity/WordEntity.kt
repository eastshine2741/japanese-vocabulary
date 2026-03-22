package com.japanese.vocabulary.word.entity

import com.japanese.vocabulary.config.converter.WordMeaningListConverter
import com.japanese.vocabulary.word.dto.WordMeaning
import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(
    name = "words",
    uniqueConstraints = [UniqueConstraint(columnNames = ["user_id", "japanese_text"])]
)
class WordEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "japanese_text", nullable = false, length = 255)
    val japaneseText: String,

    @Column(length = 255)
    val reading: String? = null,

    @Convert(converter = WordMeaningListConverter::class)
    @Column(name = "meanings", columnDefinition = "JSON", nullable = false)
    var meanings: List<WordMeaning> = emptyList(),

    @Column(name = "created_at")
    val createdAt: Instant = Instant.now()
)
