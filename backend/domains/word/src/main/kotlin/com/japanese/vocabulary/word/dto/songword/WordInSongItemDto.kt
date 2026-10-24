package com.japanese.vocabulary.word.dto.songword

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
    /** 이 단어 카드를 한 번이라도 리뷰했다. 단계·줄 학습 카드가 '처음 보는 단어'로 고르는 기준(REMAINING)의 반대다. */
    val isStudied: Boolean = false,
)
