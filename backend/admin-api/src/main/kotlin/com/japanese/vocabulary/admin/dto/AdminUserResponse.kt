package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminUserResponse(
    val id: Long,
    val provider: String,
    val username: String,
    val email: String?,
    val name: String?,
    val createdAt: Instant?,
    val deletedAt: Instant?,
    val wordCount: Long,
    /** 곡 단어장 수. 전체 단어장은 시스템이 만들어 주는 것이라 세지 않는다. */
    val songDeckCount: Long,
    /** 유저가 직접 만든 일반 단어장 수. */
    val customDeckCount: Long,
    val lastWordSavedAt: Instant?,
    val lastReviewedAt: Instant?,
)
