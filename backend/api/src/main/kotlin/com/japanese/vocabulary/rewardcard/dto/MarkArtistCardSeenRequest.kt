package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade

/** 강화 연출에서 보여 준 등급. 그 사이 또 오른 등급은 다음에 다시 뜬다. */
data class MarkArtistCardSeenRequest(
    val grade: ArtistCardGrade,
)
