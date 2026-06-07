package com.japanese.vocabulary.song.dto

data class SongDto(
    val song: SongInfoDto,
    val studyUnits: List<StudyUnitDto>,
    val youtubeUrl: String?,
    val lyricsSourceName: String?,
    val lyricsSourceUrl: String?,
)
