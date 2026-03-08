package com.japanese.vocabulary.model

data class SongStudyData(
    val song: SongInfo,
    val studyUnits: List<StudyUnit>,
    val vocabularyCandidates: List<VocabularyCandidate>
)
