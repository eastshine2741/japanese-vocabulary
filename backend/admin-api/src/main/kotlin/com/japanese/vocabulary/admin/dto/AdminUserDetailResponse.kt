package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminUserDetailResponse(
    val user: AdminUserResponse,
    val learning: AdminUserLearningResponse,
    val decks: List<AdminUserDeckResponse>,
)

/** 복습 상태 분포는 앱의 단어장 통계와 같은 판정식(`DeckRepository.findAllDeckDetailStats`)을 쓴다. */
data class AdminUserLearningResponse(
    val wordCount: Long,
    val dueCount: Long,
    val newCount: Long,
    val studyingCount: Long,
    val masteredCount: Long,
    val lastWordSavedAt: Instant?,
    val lastReviewedAt: Instant?,
    /** 최근 30일(KST 학습일 기준) 중 복습한 날 수. */
    val reviewDaysLast30: Long,
    /** 최근 30일 복습 횟수 합. */
    val reviewCountLast30: Long,
)

data class AdminUserDeckResponse(
    val id: Long,
    /** DEFAULT / SONG / CUSTOM */
    val kind: String,
    val title: String,
    val description: String,
    val songId: Long?,
    val songTitle: String?,
    val songArtist: String?,
    val wordCount: Long,
    val dueCount: Long,
    val newCount: Long,
    val studyingCount: Long,
    val masteredCount: Long,
    val createdAt: Instant?,
)
