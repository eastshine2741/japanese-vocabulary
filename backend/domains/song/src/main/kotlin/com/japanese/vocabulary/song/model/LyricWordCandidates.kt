package com.japanese.vocabulary.song.model

import com.fasterxml.jackson.annotation.JsonInclude

@JsonInclude(JsonInclude.Include.NON_NULL)
data class LyricWordCandidates(
    val candidates: List<WordCandidate>,
    val lineCandidates: Map<String, List<Int>>,
)
