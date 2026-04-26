package com.japanese.vocabulary.word.client.jisho

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.word.client.jisho.dto.JishoResponse
import com.japanese.vocabulary.word.dto.WordDefinitionDTO
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient

@Component
class JishoClient {

    private val webClient = WebClient.builder()
        .baseUrl("https://jisho.org")
        .defaultHeader("User-Agent", "JapaneseVocabularyApp/1.0")
        .build()

    fun lookup(word: String): WordDefinitionDTO {
        val response = webClient.get()
            .uri { uriBuilder ->
                uriBuilder.path("/api/v1/search/words")
                    .queryParam("keyword", word)
                    .build()
            }
            .retrieve()
            .bodyToMono(JishoResponse::class.java)
            .block()

        val entry = response?.data?.firstOrNull()
            ?: throw BusinessException(ErrorCode.DEFINITION_NOT_FOUND)

        val japanese = entry.japanese.firstOrNull()
        val japaneseText = japanese?.word ?: japanese?.reading ?: word
        val reading = japanese?.reading ?: japaneseText

        val sense = entry.senses.firstOrNull()
        val meanings = sense?.englishDefinitions ?: emptyList()
        val partsOfSpeech = sense?.partsOfSpeech ?: emptyList()

        val jlptLevel = entry.tags.firstOrNull { it.startsWith("jlpt-") }

        return WordDefinitionDTO(
            japanese = japaneseText,
            reading = reading,
            meanings = meanings,
            partsOfSpeech = partsOfSpeech,
            jlptLevel = jlptLevel
        )
    }
}
