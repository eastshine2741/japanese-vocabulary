package com.japanese.vocabulary.app.song.dto

import kotlinx.serialization.Serializable

@Serializable
data class SongStudyData(
    val song: SongInfo,
    val studyUnits: List<StudyUnit>,
    val vocabularyCandidates: List<VocabularyCandidate>,
    val youtubeUrl: String? = null
)
