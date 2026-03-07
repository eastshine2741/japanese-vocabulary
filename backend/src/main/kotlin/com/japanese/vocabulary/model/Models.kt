package com.japanese.vocabulary.model

data class Song(
    val id: String?,
    val title: String,
    val artist: String,
    val language: String = "ja"
)

data class LyricLine(
    val index: Int,
    val text: String
)

data class StudyUnit(
    val index: Int,
    val originalText: String,
    val readingHint: String? = null,
    val translationHint: String? = null
)

data class VocabularyCandidate(
    val word: String,
    val reading: String,
    val partOfSpeech: String? = null,
    val sourceLineIndex: Int
)

data class SongStudyData(
    val song: Song,
    val studyUnits: List<StudyUnit>,
    val vocabularyCandidates: List<VocabularyCandidate>
)
