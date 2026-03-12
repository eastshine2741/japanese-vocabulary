package com.japanese.vocabulary.app.model

import kotlinx.serialization.Serializable

@Serializable
data class AuthRequest(val name: String, val password: String)

@Serializable
data class AuthResponse(val token: String)

@Serializable
data class SongInfo(
    val id: Long,
    val title: String,
    val artist: String,
    val lyricType: String
)

@Serializable
data class Token(
    val surface: String,
    val baseForm: String,
    val reading: String?,
    val partOfSpeech: String,
    val charStart: Int,
    val charEnd: Int
)

@Serializable
data class StudyUnit(
    val index: Int,
    val originalText: String,
    val startTimeMs: Long? = null,
    val tokens: List<Token> = emptyList()
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

@Serializable
data class WordDefinitionDTO(
    val japanese: String,
    val reading: String,
    val meanings: List<String>,
    val partsOfSpeech: List<String>,
    val jlptLevel: String? = null
)

@Serializable
data class AddWordRequest(
    val japanese: String,
    val reading: String,
    val koreanText: String,
    val songId: Long,
    val lyricLine: String
)

@Serializable
data class WordListItem(
    val id: Long,
    val japanese: String,
    val reading: String,
    val koreanText: String,
    val songTitle: String? = null,
    val lyricLine: String? = null
)

@Serializable
data class WordListResponse(
    val words: List<WordListItem>,
    val nextCursor: Long? = null
)

@Serializable
data class FlashcardDTO(
    val id: Long,
    val wordId: Long,
    val japanese: String,
    val reading: String? = null,
    val koreanText: String? = null,
    val songTitle: String? = null,
    val lyricLine: String? = null,
    val state: Int,
    val due: String
)

@Serializable
data class DueFlashcardsResponse(
    val cards: List<FlashcardDTO>,
    val totalCount: Int
)

@Serializable
data class ReviewRequest(
    val rating: Int
)

@Serializable
data class ReviewResponse(
    val id: Long,
    val state: Int,
    val due: String,
    val stability: Double,
    val difficulty: Double
)

@Serializable
data class FlashcardStatsResponse(
    val total: Long,
    val due: Long,
    val newCount: Long,
    val learning: Long,
    val review: Long
)

@Serializable
data class UserSettingsDTO(
    val requestRetention: Double
)
