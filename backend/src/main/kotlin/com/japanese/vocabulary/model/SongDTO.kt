package com.japanese.vocabulary.model

data class SongDTO(
    val song: SongInfo,
    val studyUnits: List<StudyUnit>,
    val vocabularyCandidates: List<VocabularyCandidate>,
    val youtubeUrl: String?
)
