package com.japanese.vocabulary.admin.push.dto

data class ManualPushRequest(
    val userId: Long,
    val title: String,
    val body: String,
    val data: Map<String, String> = emptyMap(),
)
