package com.japanese.vocabulary.song.dto

data class SongDTO(
    val song: SongInfo,
    val studyUnits: List<StudyUnit>,
    val youtubeUrl: String?,
    val lyricsSourceUrl: String?,
)
