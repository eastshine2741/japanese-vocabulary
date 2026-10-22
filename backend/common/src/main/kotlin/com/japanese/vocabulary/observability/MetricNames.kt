package com.japanese.vocabulary.observability

object MetricNames {
    const val SONG_SEARCH_CACHE = "kotonoha.song.search.cache"
    const val SONG_ANALYSIS_WORK_DURATION = "kotonoha.song.analysis.work.duration"
    const val SONG_ANALYSIS_STAGE_DURATION = "kotonoha.song.analysis.stage.duration"
    const val SONG_ANALYSIS_WORKS = "kotonoha.song.analysis.works"
    const val SONG_ANALYSIS_WORK_TIMEOUTS = "kotonoha.song.analysis.work.timeouts"
    const val SONG_ANALYSIS_OLDEST_PENDING_AGE = "kotonoha.song.analysis.oldest.pending.age"
    const val GEMINI_CALL_DURATION = "kotonoha.gemini.call.duration"
    const val GEMINI_TOKENS = "kotonoha.gemini.tokens"
    const val GEMINI_CALL_RETRIES = "kotonoha.gemini.call.retries"
    const val JEV_CALL_DURATION = "kotonoha.jev.call.duration"
    const val JEV_TOKENS = "kotonoha.jev.tokens"
    const val JEV_CALL_RETRIES = "kotonoha.jev.call.retries"
    const val LLM_COST = "kotonoha.llm.cost.usd"
    const val USERS_REGISTERED = "kotonoha.users.registered"
}
