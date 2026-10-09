package com.japanese.vocabulary.song.model

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo

/** 제보 승인 때 곡과 active 가사에 적용하는 수정. 필드 편집기가 아니라 엔티티별로 허용한 것만 둔다. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "op")
@JsonSubTypes(
    JsonSubTypes.Type(SongEditOp.SetYoutubeUrl::class, name = "SET_YOUTUBE_URL"),
    JsonSubTypes.Type(SongEditOp.SetLineText::class, name = "SET_LINE_TEXT"),
    JsonSubTypes.Type(SongEditOp.SetLineTranslation::class, name = "SET_LINE_TRANSLATION"),
    JsonSubTypes.Type(SongEditOp.SetTokenReading::class, name = "SET_TOKEN_READING"),
    JsonSubTypes.Type(SongEditOp.SetTokenMeaning::class, name = "SET_TOKEN_MEANING"),
    JsonSubTypes.Type(SongEditOp.ReplaceLineTokens::class, name = "REPLACE_LINE_TOKENS"),
)
sealed class SongEditOp {
    data class SetYoutubeUrl(val value: String?) : SongEditOp()

    data class SetLineText(val lineIndex: Int, val value: String) : SongEditOp()

    data class SetLineTranslation(val lineIndex: Int, val value: String?) : SongEditOp()

    data class SetTokenReading(val lineIndex: Int, val charStart: Int, val charEnd: Int, val value: String?) : SongEditOp()

    data class SetTokenMeaning(val lineIndex: Int, val charStart: Int, val charEnd: Int, val value: String?) : SongEditOp()

    data class ReplaceLineTokens(val lineIndex: Int, val tokens: List<Token>) : SongEditOp()
}
