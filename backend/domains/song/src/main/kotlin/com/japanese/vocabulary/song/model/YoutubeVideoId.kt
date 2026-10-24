package com.japanese.vocabulary.song.model

object YoutubeVideoId {
    private val IN_URL = Regex("""(?:v=|youtu\.be/|shorts/|embed/)([a-zA-Z0-9_-]{11})""")
    private val BARE = Regex("""[a-zA-Z0-9_-]{11}""")

    /** URL 이나 id 그대로에서 11자 video id 를 꺼낸다. */
    fun parse(value: String?): String? {
        val trimmed = value?.trim() ?: return null
        return IN_URL.find(trimmed)?.groupValues?.get(1) ?: trimmed.takeIf { BARE.matches(it) }
    }
}
