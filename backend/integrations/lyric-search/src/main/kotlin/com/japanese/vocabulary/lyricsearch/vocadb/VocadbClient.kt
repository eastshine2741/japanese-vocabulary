package com.japanese.vocabulary.lyricsearch.vocadb

import com.japanese.vocabulary.lyricsearch.LyricsResult
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

@Order(2)
@Component
class VocadbClient(restClientBuilder: RestClient.Builder) :
    VocadbCompatibleClient(restClientBuilder, "https://vocadb.net") {

    override val providerName = "VocaDB"

    override fun toResult(songId: Long, lyrics: String) =
        LyricsResult(vocadbId = songId, lyrics = lyrics, isSynced = false)
}
