package com.japanese.vocabulary.lyricsearch.utaitedb

import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.lyricsearch.vocadb.VocadbCompatibleClient
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

/** Fallback for VocaDB, which a Cloudflare bot challenge can answer with 403. Song ids are its own. */
@Order(3)
@Component
class UtaitedbClient(restClientBuilder: RestClient.Builder) :
    VocadbCompatibleClient(restClientBuilder, "https://utaitedb.net") {

    override val providerName = "UtaiteDB"

    override fun toResult(songId: Long, lyrics: String) =
        LyricsResult(utaitedbId = songId, lyrics = lyrics, isSynced = false)
}
