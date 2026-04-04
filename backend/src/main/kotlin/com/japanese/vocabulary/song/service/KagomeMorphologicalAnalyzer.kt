package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.dto.PartOfSpeech
import com.japanese.vocabulary.song.dto.TokenInfo
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono

class KagomeMorphologicalAnalyzer(
    private val baseUrl: String,
    webClientBuilder: WebClient.Builder
) : MorphologicalAnalyzer {

    private val webClient = webClientBuilder.baseUrl(baseUrl).build()

    data class KagomeRequest(val sentence: String, val mode: String = "normal")
    data class KagomeToken(
        val surface: String,
        val pos: List<String>,
        val base_form: String,
        val reading: String,
        val pronunciation: String,
        val start: Int,
        val end: Int
    )
    data class KagomeResponse(val status: Boolean, val tokens: List<KagomeToken>)

    override fun analyze(text: String): List<TokenInfo> {
        val response = webClient.put()
            .uri("/tokenize")
            .bodyValue(KagomeRequest(sentence = text))
            .retrieve()
            .bodyToMono<KagomeResponse>()
            .block() ?: return emptyList()

        return response.tokens.mapNotNull { token ->
            val posName = token.pos.firstOrNull() ?: return@mapNotNull null
            val partOfSpeech = PartOfSpeech.fromSudachiOrNull(posName) ?: return@mapNotNull null
            val reading = token.reading.takeIf { it != "*" }
            TokenInfo(
                surface = token.surface,
                baseForm = token.base_form,
                reading = reading,
                baseFormReading = reading,
                partOfSpeech = partOfSpeech,
                charStart = token.start,
                charEnd = token.end
            )
        }
    }
}
