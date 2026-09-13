package com.japanese.vocabulary.notification.dto

data class ManualPushRequest(
    val userId: Long,
    val title: String,
    val body: String,
    val data: Map<String, String> = emptyMap(),
)
