package com.japanese.vocabulary.songanalysis.entity

/**
 * 곡 분석 파이프라인의 단계. 단계 하나가 큐 메시지 하나이고 `song_analysis_work_stage` 행 하나다.
 * 순서가 곧 실행 순서다 — [next] 가 다음 메시지를 정한다.
 *
 * [ANALYZE_LYRICS] 는 가사 번역과 단어 준비(분절 → 규칙 → 사전) 두 갈래를 한 메시지 안에서 동시에
 * 돌린다. 나눠서 합류시키는 비용에 비해 얻는 게 없고, 갈래별 산출물은 행 안에 따로 남는다.
 *
 * 곡·가사 행은 [COMPLETE] 가 분석 결과와 함께 만든다. 분석이 끝나지 않은 곡이 앱에 보이지 않게 하려는 것이다.
 * [CREATE_SONG_AND_LYRIC] 는 그 전 파이프라인의 단계로, 이미 그 단계에 와 있는 작업만 돈다.
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
        get() = nextIn(null)

    /** 이 단계가 산출물을 읽는 앞 단계. 다시 돌릴 범위([rerunScope])가 여기서 나온다. */
    val dependsOn: Set<SongAnalysisWorkStage>
        get() = when (this) {
            FETCH_LYRICS, FETCH_YOUTUBE -> emptySet()
            CREATE_SONG_AND_LYRIC -> setOf(FETCH_LYRICS, FETCH_YOUTUBE)
            ANALYZE_LYRICS -> setOf(FETCH_LYRICS)
            SELECT_SENSES -> setOf(ANALYZE_LYRICS)
            TRANSLATE_SENSES -> setOf(SELECT_SENSES)
            COMPLETE -> setOf(FETCH_LYRICS, FETCH_YOUTUBE, ANALYZE_LYRICS, SELECT_SENSES, TRANSLATE_SENSES)
        }

    /** 이 단계와, 그 산출물에 기대는 단계 전부. 범위 밖 단계는 돌지 않고 곡의 지금 상태가 그대로 남는다. */
    fun rerunScope(): Set<SongAnalysisWorkStage> {
        val scope = mutableSetOf(this)
        do {
            val added = entries.filter { it != CREATE_SONG_AND_LYRIC && it !in scope && it.dependsOn.any(scope::contains) }
            scope += added
        } while (added.isNotEmpty())
        return scope
    }

    /** [scope] 가 null 이면 파이프라인 전체다. */
    fun nextIn(scope: Set<SongAnalysisWorkStage>?): SongAnalysisWorkStage? =
        entries.drop(ordinal + 1).firstOrNull { it != CREATE_SONG_AND_LYRIC && (scope == null || it in scope) }

    /**
     * 이 단계부터 다시 돌릴 때 원본 작업에서 산출물을 물려받아야 하는 단계. FETCH_YOUTUBE 는 범위 밖이면 곡의
     * 지금 MV 를 그대로 두므로 읽지 않고, MV 만 다시 찾을 땐 COMPLETE 가 가사 쪽 산출물을 읽지 않는다.
     */
    fun inheritedInputs(): Set<SongAnalysisWorkStage> {
        if (this == FETCH_YOUTUBE) return emptySet()
        val scope = rerunScope()
        return scope.flatMap { it.dependsOn }.toSet() - scope - FETCH_YOUTUBE
    }

    companion object {
        val FIRST = FETCH_LYRICS
    }
}
