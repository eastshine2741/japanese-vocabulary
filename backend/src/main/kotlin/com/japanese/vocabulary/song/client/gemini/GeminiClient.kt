package com.japanese.vocabulary.song.client.gemini

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.song.client.gemini.dto.KoreanLyricLine
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

@Component
class GeminiClient(
    restClientBuilder: RestClient.Builder,
    @Value("\${gemini.api-key}") private val apiKey: String,
    @Value("\${gemini.model}") private val model: String,
    private val objectMapper: ObjectMapper
) {
    private val restClient = restClientBuilder
        .baseUrl("https://generativelanguage.googleapis.com")
        .build()

    fun translateLyrics(lyricLines: List<Map<String, Any?>>): List<KoreanLyricLine> {
        val inputJson = objectMapper.writeValueAsString(lyricLines)

        val requestBody = mapOf(
            "system_instruction" to mapOf(
                "parts" to listOf(
                    mapOf("text" to SYSTEM_PROMPT)
                )
            ),
            "contents" to listOf(
                mapOf(
                    "parts" to listOf(
                        mapOf("text" to inputJson)
                    )
                )
            ),
            "generationConfig" to mapOf(
                "responseMimeType" to "application/json",
                "temperature" to 0.3
            )
        )

        val response = restClient.post()
            .uri("/v1beta/models/{model}:generateContent?key={apiKey}", model, apiKey)
            .header("Content-Type", "application/json")
            .body(requestBody)
            .retrieve()
            .body(Map::class.java)
            ?: throw RuntimeException("Empty response from Gemini API")

        val candidates = response["candidates"] as? List<*>
            ?: throw RuntimeException("No candidates in Gemini response")
        val firstCandidate = candidates.firstOrNull() as? Map<*, *>
            ?: throw RuntimeException("Empty candidates in Gemini response")
        val content = firstCandidate["content"] as? Map<*, *>
            ?: throw RuntimeException("No content in Gemini candidate")
        val parts = content["parts"] as? List<*>
            ?: throw RuntimeException("No parts in Gemini content")
        val firstPart = parts.firstOrNull() as? Map<*, *>
            ?: throw RuntimeException("Empty parts in Gemini content")
        val text = firstPart["text"] as? String
            ?: throw RuntimeException("No text in Gemini part")

        return objectMapper.readValue(
            text,
            objectMapper.typeFactory.constructCollectionType(List::class.java, KoreanLyricLine::class.java)
        )
    }

    companion object {
        private val SYSTEM_PROMPT = """
            You are a Japanese-to-Korean lyrics translator. You receive a JSON array of lyric lines, each with "index", "text", and "words" (array of {baseForm, pos}) fields.

            For each line, produce:
            - "index": same as input
            - "koreanLyrics": natural Korean translation of the Japanese text
            - "koreanPronounciation": Korean pronunciation of the original Japanese text (한국어로 표기한 일본어 발음)
            - "words": for each word in the input "words" array, produce {"baseForm": same as input, "koreanText": Korean meaning of the word in this lyric context (1 concise dictionary-style meaning)}

            Translation guidelines:
            1. Read all lyrics first. Analyze the overall theme and tone, then reflect them in the Korean translation.
            2. Preserve the tone and politeness level (경어체/반말) of each line.
            3. For Japan-specific cultural terms: use the equivalent Korean word if one exists; otherwise keep the original Japanese pronunciation in Korean (한국어 발음).
            4. If the original uses rhyme or wordplay based on Japanese pronunciation, recreate it with Korean words of similar meaning.
            5. Use four-character idioms (사자성어/四字熟語) when appropriate. However, if an idiom carries a different meaning in Korean vs Japanese, write it out in plain Korean instead.
            6. Do not use Korean slang or neologisms (신조어).

            Rules:
            - Translate all lines, preserving the order and count
            - Return ONLY a JSON array of objects with the four fields above
            - Do not skip empty lines — return empty strings for them, with an empty words array
        """.trimIndent()
    }
}
