package com.japanese.vocabulary.word.entity

import com.japanese.vocabulary.config.converter.WordMeaningListConverter
import com.japanese.vocabulary.word.dto.WordMeaning
import jakarta.persistence.*
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant

@Entity
@Table(
    name = "words",
    uniqueConstraints = [UniqueConstraint(columnNames = ["user_id", "japanese_text"])]
)
@EntityListeners(AuditingEntityListener::class)
class WordEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "japanese_text", nullable = false, length = 255)
    val japaneseText: String,

    @Column(length = 255)
    var reading: String? = null,

    @Convert(converter = WordMeaningListConverter::class)
    @Column(name = "meanings", columnDefinition = "JSON", nullable = false)
    var meanings: List<WordMeaning> = emptyList(),

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    var createdAt: Instant? = null
)
