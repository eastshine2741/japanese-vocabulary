package com.japanese.vocabulary.app.model

import kotlinx.serialization.Serializable

@Serializable
data class Song(
    val id: String?,
    val title: String,
    val artist: String,
    val language: String = "ja"
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
    val reading: String,
    val partOfSpeech: String? = null,
    val sourceLineIndex: Int
)

@Serializable
data class SongStudyData(
    val song: Song,
    val studyUnits: List<StudyUnit>,
    val vocabularyCandidates: List<VocabularyCandidate>
)

@Serializable
data class SongSearchItem(
    val id: String,
    val title: String,
    val thumbnail: String,
    val channelTitle: String,
    val duration: String
)

@Serializable
data class SongSearchResponse(
    val items: List<SongSearchItem>,
    val nextPageToken: String? = null
)
