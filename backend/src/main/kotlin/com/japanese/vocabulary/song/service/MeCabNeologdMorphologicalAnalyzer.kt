package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.dto.PartOfSpeech
import com.japanese.vocabulary.song.dto.TokenInfo
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono

class MeCabNeologdMorphologicalAnalyzer(
    private val baseUrl: String,
    webClientBuilder: WebClient.Builder
) : MorphologicalAnalyzer {

    private val webClient = webClientBuilder.baseUrl(baseUrl).build()

    data class MeCabToken(
        val surface: String,
        val pos: String,
        val pos1: String?,
        val baseform: String?,
        val reading: String?,
        val pronounciation: String?,
        val conjugatedform: String?,
        val inflection: String?
    )

    override fun analyze(text: String): List<TokenInfo> {
        val tokens = webClient.get()
            .uri { it.path("/mecab").queryParam("sentence", text).build() }
            .retrieve()
            .bodyToMono<List<MeCabToken>>()
            .block() ?: return emptyList()

        var charOffset = 0
        return tokens.mapNotNull { token ->
            val posName = token.pos
            val partOfSpeech = PartOfSpeech.fromSudachiOrNull(posName)
            val charStart = charOffset
            charOffset += token.surface.length
            val charEnd = charOffset

            if (partOfSpeech == null) return@mapNotNull null

            val reading = token.reading?.takeIf { it != "*" }
            TokenInfo(
                surface = token.surface,
                baseForm = token.baseform ?: token.surface,
                reading = reading,
                baseFormReading = reading,
                partOfSpeech = partOfSpeech,
                charStart = charStart,
                charEnd = charEnd
            )
        }
    }
}
