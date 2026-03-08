package com.japanese.vocabulary.app.model

import kotlinx.serialization.Serializable

@Serializable
data class SongInfo(
    val id: Long,
    val title: String,
    val artist: String,
    val lyricType: String
)

@Serializable
data class StudyUnit(
    val index: Int,
    val originalText: String,
    val readingHint: String? = null,
    val translationHint: String? = null
)

@Serializable
data class VocabularyCandidate(
    val word: String,
    val reading: String?,
    val partOfSpeech: String? = null,
    val sourceLineIndex: Int
)

@Serializable
data class SongStudyData(
    val song: SongInfo,
    val studyUnits: List<StudyUnit>,
    val vocabularyCandidates: List<VocabularyCandidate>,
    val youtubeUrl: String? = null
)

@Serializable
data class SongSearchItem(
    val id: String,
    val title: String,
    val thumbnail: String,
    val artistName: String,
    val durationSeconds: Int
)

@Serializable
data class SongSearchResponse(
    val items: List<SongSearchItem>,
    val nextOffset: Int? = null
)
