package com.japanese.vocabulary.user.dto

/** 남에게 보이는 프로필. 이메일은 싣지 않는다. */
data class PublicUserProfileResponse(
    val userId: Long,
    val username: String,
    val name: String,
    val profileImageUrl: String?,
    /** 요청한 유저 자신. 앱은 이때 편집할 수 있는 내 프로필을 띄운다. */
    val me: Boolean,
)
