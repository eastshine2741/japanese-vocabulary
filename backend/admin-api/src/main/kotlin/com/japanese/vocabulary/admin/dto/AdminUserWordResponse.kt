package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminUserWordResponse(
    val id: Long,
    val japaneseText: String,
    val reading: String?,
    val senses: List<AdminWordSenseResponse>,
    /** senses 의 예문이 가리키는 곡들 (논리 참조라 지워진 곡은 빠질 수 있다). */
    val sourceSongs: List<AdminWordSongRefResponse>,
    /** 불변식상 항상 있어야 하지만 깨진 데이터도 보여 줘야 하므로 nullable. */
    val flashcard: AdminWordFlashcardResponse?,
    val createdAt: Instant?,
)

data class AdminWordSenseResponse(
    val meaning: String,
    val partOfSpeech: String,
    val jlpt: String?,
    val examples: List<AdminWordExampleResponse>,
)

data class AdminWordExampleResponse(
    val text: String,
    val translation: String?,
    val songId: Long?,
    val lineIndex: Int?,
)

data class AdminWordSongRefResponse(
    val id: Long,
    val title: String,
    val artist: String,
)

data class AdminWordFlashcardResponse(
    /** NEW / STUDYING / MASTERED — 앱의 단어장 통계와 같은 판정. */
    val status: String,
    val fsrsState: Int,
    val due: Instant,
    val lastReview: Instant?,
)
