package com.japanese.vocabulary.songanalysis.entity

/**
 * 곡 분석 파이프라인의 단계. 단계 하나가 큐 메시지 하나이고 `song_analysis_work_stage` 행 하나다.
 * 순서가 곧 실행 순서다 — [next] 가 다음 메시지를 정한다.
 *
 * [ANALYZE_LYRICS] 는 가사 번역과 단어 준비(분절 → 규칙 → 사전) 두 갈래를 한 메시지 안에서 동시에
 * 돌린다. 나눠서 합류시키는 비용에 비해 얻는 게 없고, 갈래별 산출물은 행 안에 따로 남는다.
 *
 * 이름은 저장값이므로 바꾸지 않는다. 구 파이프라인이 남긴 행이 [ANALYZE_LYRICS] 를 쓴다.
 */
enum class SongAnalysisWorkStage {
    FETCH_LYRICS,
    FETCH_YOUTUBE,
    CREATE_SONG_AND_LYRIC,
    ANALYZE_LYRICS,
    SELECT_SENSES,
    TRANSLATE_SENSES,
    COMPLETE;

    val next: SongAnalysisWorkStage?
        get() = entries.getOrNull(ordinal + 1)

    companion object {
        val FIRST = FETCH_LYRICS
    }
}
