package com.japanese.vocabulary.song.client.gemini

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.song.client.gemini.dto.TranslationResult
import com.japanese.vocabulary.song.client.gemini.dto.WordMeaningResult
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

@Component
class GeminiClient(
    restClientBuilder: RestClient.Builder,
    @Value("\${gemini.api-key}") private val apiKey: String,
    @Value("\${gemini.translation-model}") private val translationModel: String,
    @Value("\${gemini.word-meaning-model}") private val wordMeaningModel: String,
    private val objectMapper: ObjectMapper
) {
    private val restClient = restClientBuilder
        .baseUrl("https://generativelanguage.googleapis.com")
        .build()

    /**
     * Translate lyrics to Korean with pronunciation.
     * Input: [{index, text}] — no morphological data needed.
     * Uses the higher-quality model for natural translation.
     */
    fun translateLyrics(lyricLines: List<Map<String, Any?>>): List<TranslationResult> {
        return callGemini(
            model = translationModel,
            systemPrompt = TRANSLATION_PROMPT,
            input = lyricLines,
            responseType = TranslationResult::class.java,
            temperature = 0.3,
            responseSchema = TRANSLATION_SCHEMA
        )
    }

    /**
     * Look up Korean meanings for morphologically analyzed words.
     * Input: [{index, text, words: [{surface, baseForm, pos}]}]
     * Uses a lightweight model — word meaning lookup is a simpler task than translation.
     *
     * WHY SEPARATE FROM TRANSLATION:
     * - Combining translation + word meanings in one call increased latency from 30s to 5min.
     * - Output token cost is 4-8x input token cost, so including morphological hints in input
     *   is cheaper than asking the LLM to identify words from scratch (which increases output).
     * - Different models are optimal: translation needs quality (pro), meanings need speed (flash-lite).
     */
    fun lookupWordMeanings(lyricLines: List<Map<String, Any?>>): List<WordMeaningResult> {
        return callGemini(
            model = wordMeaningModel,
            systemPrompt = WORD_MEANING_PROMPT,
            input = lyricLines,
            responseType = WordMeaningResult::class.java,
            temperature = 0.0,
            responseSchema = WORD_MEANING_SCHEMA
        )
    }

    private fun <T> callGemini(
        model: String,
        systemPrompt: String,
        input: Any,
        responseType: Class<T>,
        temperature: Double,
        responseSchema: Map<String, Any>? = null
    ): List<T> {
        val inputJson = objectMapper.writeValueAsString(input)

        val generationConfig = mutableMapOf<String, Any>(
            "responseMimeType" to "application/json",
            "temperature" to temperature
        )
        if (responseSchema != null) {
            generationConfig["responseSchema"] = responseSchema
        }

        val requestBody = mapOf(
            "system_instruction" to mapOf(
                "parts" to listOf(mapOf("text" to systemPrompt))
            ),
            "contents" to listOf(
                mapOf("parts" to listOf(mapOf("text" to inputJson)))
            ),
            "generationConfig" to generationConfig
        )

        val response = restClient.post()
            .uri("/v1beta/models/{model}:generateContent?key={apiKey}", model, apiKey)
            .header("Content-Type", "application/json")
            .body(requestBody)
            .retrieve()
            .body(Map::class.java)
            ?: throw RuntimeException("Empty response from Gemini API")

        val text = extractText(response)

        return objectMapper.readValue(
            text,
            objectMapper.typeFactory.constructCollectionType(List::class.java, responseType)
        )
    }

    private fun extractText(response: Map<*, *>): String {
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
        return firstPart["text"] as? String
            ?: throw RuntimeException("No text in Gemini part")
    }

    companion object {
        private val TRANSLATION_PROMPT = """
            You are a Japanese-to-Korean lyrics translator. You receive a JSON array of lyric lines, each with "index" and "text" fields.

            For each line, produce:
            - "index": same as input
            - "koreanLyrics": natural Korean translation of the Japanese text
            - "koreanPronounciation": Korean pronunciation of the original Japanese text (한국어로 표기한 일본어 발음)

            Translation guidelines:
            1. Read all lyrics first. Analyze the overall theme and tone, then reflect them in the Korean translation.
            2. Preserve the tone and politeness level (경어체/반말) of each line.
            3. For Japan-specific cultural terms: use the equivalent Korean word if one exists; otherwise keep the original Japanese pronunciation in Korean (한국어 발음).
            4. If the original uses rhyme or wordplay based on Japanese pronunciation, recreate it with Korean words of similar meaning.
            5. Use four-character idioms (사자성어/四字熟語) when appropriate. However, if an idiom carries a different meaning in Korean vs Japanese, write it out in plain Korean instead.
            6. Do not use Korean slang or neologisms (신조어).

            Rules:
            - Translate all lines, preserving the order and count
            - Return ONLY a JSON array of objects with the three fields above
            - Do not skip empty lines — return empty strings for them
        """.trimIndent()

        /**
         * Word meaning prompt — strict 1:1 mapping with input words.
         *
         * WHY "DO NOT MERGE OR SPLIT":
         * LLM segmentation is non-deterministic and unreliable. When allowed to merge/split,
         * the LLM inconsistently combines words (e.g., 晴れ+舞台→晴れ舞台) or fails to split
         * (e.g., 何も stays merged). Keeping input segmentation intact and only correcting
         * baseForm produces the most stable results.
         */
        private val WORD_MEANING_PROMPT = """
            You receive a JSON array of lyric lines.
            Each line has "index", "text", and "words" (morphological analysis results with surface, baseForm, and pos).

            The goal is to help a Korean-speaking learner study Japanese vocabulary from lyrics.

            STRICT RULES:
            1. Output one entry for EVERY word in the input "words" array, in the same order. NEVER skip any entry.
            2. You may correct a wrong baseForm (e.g. いう → いい when context means "good").
            3. Do NOT merge or split words. Keep the input segmentation exactly as given.
            4. When a conjugated form has its own dictionary entry with a meaning distinct from the base word, use that form as baseForm so the learner can look it up directly (e.g. なら → なら "~라면", not だ "~이다").

            For each word, return:
            - "surface": the exact characters as they appear in the original text
            - "baseForm": the form most useful for a learner to look up in a dictionary
            - "koreanText": Korean meaning suitable for flashcard study. If the word has multiple relevant meanings, return all with comma-joined.

            Korean meaning rules by part of speech:
            - NOUN → Korean noun (夜→밤, 人生→인생)
            - VERB → Korean verb ending in -다 (走る→달리다)
            - ADJECTIVE → Korean adjective ending in -다 (美しい→아름답다)
            - NA_ADJECTIVE → Korean adjective ending in -하다 (静か→조용하다)
            - ADVERB → Korean adverb (そろそろ→슬슬)
            - PRONOUN → Korean pronoun (私→나)
            - PARTICLE → Korean grammatical equivalent (は→~은/는)
            - AUXILIARY_VERB → Korean grammatical equivalent (です→~입니다)
            - PREFIX → meaning of the prefix
            - SUFFIX → meaning of the suffix
            - CONJUNCTION → Korean conjunction (しかし→하지만)
            - INTERJECTION → Korean equivalent

            Return ONLY a JSON array:
            [{"index": N, "words": [{"surface": "...", "baseForm": "...", "koreanText": "..."}]}]
        """.trimIndent()

        private val TRANSLATION_SCHEMA = mapOf(
            "type" to "ARRAY",
            "items" to mapOf(
                "type" to "OBJECT",
                "properties" to mapOf(
                    "index" to mapOf("type" to "INTEGER"),
                    "koreanLyrics" to mapOf("type" to "STRING"),
                    "koreanPronounciation" to mapOf("type" to "STRING")
                ),
                "required" to listOf("index", "koreanLyrics", "koreanPronounciation")
            )
        )

        private val WORD_MEANING_SCHEMA = mapOf(
            "type" to "ARRAY",
            "items" to mapOf(
                "type" to "OBJECT",
                "properties" to mapOf(
                    "index" to mapOf("type" to "INTEGER"),
                    "words" to mapOf(
                        "type" to "ARRAY",
                        "items" to mapOf(
                            "type" to "OBJECT",
                            "properties" to mapOf(
                                "surface" to mapOf("type" to "STRING"),
                                "baseForm" to mapOf("type" to "STRING"),
                                "koreanText" to mapOf("type" to "STRING")
                            ),
                            "required" to listOf("surface", "baseForm", "koreanText")
                        )
                    )
                ),
                "required" to listOf("index", "words")
            )
        )
    }
}
