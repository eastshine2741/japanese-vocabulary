package com.japanese.vocabulary.song.dto.songdetail

data class WordsInSongDto(
    val lyricId: Long,
    val wordSummary: WordSummaryDto,
    val filterDefaults: WordFilterDefaultsDto,
    val words: List<WordInSongItemDto>,
    val lineWordIndexes: Map<Int, List<Int>>,
)
