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
            temperature = 0.0,
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
            You are an expert Japanese-to-Korean lyrics translator.

            ## Input/Output
            Receive: JSON array of lyric lines, each with "index" and "text".
            Return: JSON array with:
            - "index": same as input
            - "koreanLyrics": natural, poetic Korean translation
            - "koreanPronounciation": Korean Hangul transcription of the Japanese pronunciation

            ## Core Principles

            ### 1. Context First
            Read ALL lyrics before translating. Understand the song's theme, mood, and speaker's persona. Every word choice must serve this context — not the default dictionary definition.
            - **Slang & Nuance**: Choose slang, archaic, or uncommon meanings when context demands it. In a song about overdose, 'アガれよ' means "get high", not "go up". Capture these specific cultural nuances.

            ### 2. Preserve Artistry
            Recreate the artistic experience, not just the literal meaning.
            - **Wordplay & Sound Play**: Never ignore double meanings ('愛'/'哀', 'あくまで'/'悪魔で'). Recreate the effect in Korean even if the mechanism differs. Also, identify and replicate sound-based devices like rhymes (脚韻) and alliteration (頭韻) to preserve the song's musicality.
            - **Tone & Register**: Match 경어체/반말 precisely. 'ご覧' → '보세요', not '봐'. Reflect pronouns ('お前' ≠ '君'), interjections, and sentence-ending particles ('~わ', '~ぜ') in Korean tone. Crucially, translate interjections to preserve the relationship between speakers; 'ねぇ' is an attention-getter like '저기' or '있지', not a condescending '얘'.
                - Pay special attention to the *function* of politeness levels. A sudden shift to polite form ('です', 'ます') in an otherwise informal song can create irony, sarcasm, or emotional distance. The translation must recreate this specific rhetorical effect, not just default to a consistent politeness level.
                - Distinguish the *modality* of a statement. A sharp declaration ('辞めだ!') must be translated with equivalent finality ('그만두겠어!' or '관둬!'), not softened into a personal reflection ('그만둘래').
                - **Grammatical Nuance & Auxiliary Verbs**: Pay close attention to auxiliary verbs that modify the main verb's nuance. For example, '〜てしまう' (e.g., '罵詈はしまった') often implies regret or an unintentional action ('욕설을 해버렸네'), not the primary meaning of 'しまう' (to put away). Translate the *entire* verb phrase's nuance.
            - **Intensity**: Match emotional force. '思い知った' → '뼈저리게 깨달았다', not just '깨달았다'. Emphatic 'ユメユメ' (+ negative) → '결코/절대로', not '꿈에도'.
                - **Emphatic Prefixes & Repetition**: Translate the *function* of emphasis, not the literal word. Japanese uses prefixes like '大' (だい) or repetition for emphasis (e.g., 'ダイダイダイキライ'). Do not translate this literally as '대대대싫어해'. Instead, use natural Korean adverbs to convey the same high intensity, such as '정말 정말 정말 싫어' or '완전 싫어'. The goal is to replicate the *degree* of emotion, not the grammatical structure.
                - Preserve the original's descriptive mode. If the lyric describes a *physical sensation*, translate it as a physical sensation. Do not convert it into a purely emotional equivalent. For example, '心臓が煩かった' (my heart was noisy/bothersome) describes a physical feeling and should be translated as such ('심장이 시끄럽게 울렸다'), not just as an emotional state like '심장이 답답했어' (my heart felt stuffy/frustrated).
            - **Repetition**: Analyze the *function* of repetition. Is it for emphasis, rhythm, or to show a state of mind? The Korean translation must replicate this *function*. The emphatic '傷付きたくないない' means '상처받고 싶지 않아 않아', not the literal but incorrect '없어 없어'.
            - **Complex Nuance & Contradiction**: Do not simplify complex or contradictory expressions. A phrase like '沈めユメユメ' ('Sink! Never!') expresses internal conflict. Your translation must preserve this feeling of chaos, not resolve it into a simple command like '결코 가라앉지 마'.
            - **Voice**: Keep active/passive as original unless Korean grammar requires a change.

            ### 3. Accuracy

            **CRITICAL: Kanji/Hanja False Friends**
            This is the most common source of major errors. Japanese Kanji compounds and Korean Hanja words that look identical often have **completely different meanings or nuances**.
            - **NEVER ASSUME THEY ARE THE SAME.** Always verify the specific Japanese meaning first.
            - **Example 1 (Opposite Meaning)**: Japanese '八方美人' is negative (a people-pleaser). Korean '팔방미인' is positive (multi-talented). Translating it directly reverses the meaning. Translate descriptively instead.
            - **Example 2 (Different Meaning)**: Japanese '成敗' means 'punishment' or 'subjugation'. Korean '성패' means 'success or failure'. This is a critical mistranslation.
            - **Rule**: When in doubt, translate the *meaning* descriptively; do not perform a direct Hanja-to-Hanja character swap.

            **CRITICAL: Contextual Vocabulary & Katakana Traps**
            Katakana loanwords and words with multiple meanings are high-risk. ALWAYS prioritize the song's specific context (e.g., literary, technical, slang) over the most common dictionary definition. A default translation is a likely error.
            - **Example of Critical Failure**: In a literary context, 'ルビ' means 'furigana' (reading aids), not the gemstone 'ruby'. Mistranslating this fundamentally breaks the song's meaning. Always prioritize the context over the most common dictionary definition.
            - **Grammatical Integrity**: Ensure the part of speech in Korean matches the original Japanese function. A sequence of past-tense verbs like '断った絡まった' (cut, got tangled) should be translated as a sequence of verbs ('끊어지고 얽혔다'), not as an adjectival phrase ('끊어버린 얽힌'). The final Korean must be grammatically natural.
            - **Personification**: A word that is only created for this song should be transliterated, without interpreting meaning. e.g. '黙ってちゃん' → '다맛테쨩'
            - **Cultural Terms**: No Korean equivalent → use Hangul pronunciation ('侘び寂び' → '와비사비').
            - **Naturalness**: '薄い目' → '얇은 눈' is wrong. The final output must read like a native Korean song.

            ## Output Rules
            - Translate ALL lines in original order. Empty input → empty strings for both fields.
            - Return ONLY a valid JSON array. No surrounding text.
            - "koreanPronounciation" must be a precise Hangul transcription of the Japanese pronunciation, strictly following standard Korean transliteration rules (외래어 표기법). It must contain ONLY Hangul. Do not include any Japanese characters (e.g., 'ッ', 'テ'). For example, '断った' is '탓타', not '코탓타'; 'ド' is '도', not '드'; 'って' is '떼', not 'ッテ'. Accuracy is mandatory.
            - Non-Japanese text (e.g., "1, 2, 3"): keep koreanLyrics and koreanPronounciation consistent.
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
