package com.japanese.vocabulary.song.model

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode

enum class SongReportGroup { LYRIC_LINE, MV }

enum class SongReportTargetKind { NONE, LINE, LINE_TOKEN }

/** 제보 유형 목록은 서버가 소유한다. 선언 순서가 앱 제보 시트의 노출 순서다. */
enum class SongReportType(
    val group: SongReportGroup,
    val label: String,
    val targetKind: SongReportTargetKind,
    val suggestionRequired: Boolean,
    val tokenPrompt: String?,
    val suggestionPlaceholder: String,
) {
    LYRIC_TEXT(SongReportGroup.LYRIC_LINE, "가사 원문이 달라요", SongReportTargetKind.LINE, true, null, "맞는 가사를 적어주세요"),
    FURIGANA(SongReportGroup.LYRIC_LINE, "발음(후리가나)이 틀려요", SongReportTargetKind.LINE_TOKEN, true, "어떤 단어의 발음인가요?", "맞는 발음을 적어주세요"),
    TRANSLATION(SongReportGroup.LYRIC_LINE, "한국어 번역이 어색해요", SongReportTargetKind.LINE, true, null, "올바른 번역을 적어주세요"),
    WORD_MEANING(SongReportGroup.LYRIC_LINE, "단어 뜻이 틀려요", SongReportTargetKind.LINE_TOKEN, true, "어떤 단어인가요?", "올바른 뜻을 적어주세요"),
    SEGMENTATION(SongReportGroup.LYRIC_LINE, "단어가 잘못 나뉘었어요", SongReportTargetKind.LINE, true, null, "어떻게 나뉘어야 하나요?"),
    MV_WRONG_SONG(SongReportGroup.MV, "다른 곡의 영상이에요", SongReportTargetKind.NONE, false, null, "맞는 영상 링크를 알려주세요 (선택)"),
    MV_OTHER_VERSION(SongReportGroup.MV, "커버·라이브 등 다른 버전이에요", SongReportTargetKind.NONE, false, null, "맞는 영상 링크를 알려주세요 (선택)");

    companion object {
        fun of(name: String): SongReportType =
            entries.firstOrNull { it.name == name } ?: throw BusinessException(ErrorCode.SONG_REPORT_INVALID_TYPE)
    }
}
