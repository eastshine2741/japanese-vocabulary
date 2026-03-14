package com.japanese.vocabulary.song.dto

data class SongStudyData(
    val song: SongInfo,
    val studyUnits: List<StudyUnit>,
    val vocabularyCandidates: List<VocabularyCandidate>
)
