package com.japanese.vocabulary.song.dto.songdetail

import com.japanese.vocabulary.word.dto.AddWordRequest
import com.japanese.vocabulary.word.model.WordSense

data class WordInSongItemDto(
    val japanese: String,
    val surface: String,
    val baseForm: String?,
    val reading: String?,
    val koreanText: String?,
    val senses: List<WordSense> = emptyList(),
    val partOfSpeech: String,
    val partOfSpeechLabel: String,
    val jlpt: String?,
    val importanceScore: Double,
    val appearanceOrder: Int,
    val frequency: Int,
    val lineIndexes: List<Int>,
    val isSavedGlobally: Boolean,
    val isSavedForSong: Boolean,
    val savedWordId: Long?,
    val addRequest: AddWordRequest,
)
