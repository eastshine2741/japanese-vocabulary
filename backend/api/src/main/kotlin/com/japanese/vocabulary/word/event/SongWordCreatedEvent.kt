package com.japanese.vocabulary.word.event

data class SongWordCreatedEvent(
    val userId: Long,
    val songId: Long,
    val wordId: Long,
    val flashcardId: Long,
)
