package com.japanese.vocabulary.deck.dto

import com.japanese.vocabulary.deck.entity.DeckEntity

data class DeckDto(
    val id: Long,
    val userId: Long,
    val songId: Long,
    val title: String,
    val description: String,
)

fun DeckEntity.toDto(): DeckDto = DeckDto(
    id = id!!,
    userId = userId,
    songId = songId,
    title = title,
    description = description,
)
