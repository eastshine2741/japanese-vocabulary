package com.japanese.vocabulary.song.client.gemini

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.song.client.gemini.dto.TranslationResult
import com.japanese.vocabulary.song.client.gemini.dto.WordMeaningResult
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

@Component
class GeminiClient(
    restClientBuilder: RestClient.Builder,
    @Value("\${gemini.api-key}") private val apiKey: String,
    @Value("\${gemini.translation-model}") private val translationModel: String,
    @Value("\${gemini.word-meaning-model}") private val wordMeaningModel: String,
    private val objectMapper: ObjectMapper,
    private val meterRegistry: MeterRegistry,
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
            call = "translation",
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
     * Input: [{index, words: [{baseForm}]}] — minimum fields only (mirrors playground).
     * Uses a lightweight model — word meaning lookup is a simpler task than translation.
     *
     * WHY SEPARATE FROM TRANSLATION:
     * - Combining translation + word meanings in one call increased latency from 30s to 5min.
     * - Output token cost is 4-8x input token cost, so including morphological hints in input
     *   is cheaper than asking the LLM to identify words from scratch (which increases output).
     * - Different models are optimal: translation needs quality (pro), meanings need speed (flash-lite).
     *
     * WHY ONLY baseForm:
     * `text`, `surface`, and `pos` were observed to mislead the LLM (English-token hallucinations,
     * POS-driven mood leaks). The slim input matches the playground configuration that scored 8.6+.
     */
    fun lookupWordMeanings(lyricLines: List<Map<String, Any?>>): List<WordMeaningResult> {
        return callGemini(
            call = "word_meaning",
            model = wordMeaningModel,
            systemPrompt = WORD_MEANING_PROMPT,
            input = lyricLines,
            responseType = WordMeaningResult::class.java,
            temperature = 0.0,
            responseSchema = WORD_MEANING_SCHEMA
        )
    }

    private fun <T> callGemini(
        call: String,
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

        val sample = Timer.start(meterRegistry)
        var outcome = "success"
        try {
            val response = restClient.post()
                .uri("/v1beta/models/{model}:generateContent?key={apiKey}", model, apiKey)
                .header("Content-Type", "application/json")
                .body(requestBody)
                .retrieve()
                .body(Map::class.java)
                ?: throw RuntimeException("Empty response from Gemini API")

            recordTokenUsage(call, model, response)

            val text = extractText(response)

            return objectMapper.readValue(
                text,
                objectMapper.typeFactory.constructCollectionType(List::class.java, responseType)
            )
        } catch (e: Throwable) {
            outcome = "failure"
            throw e
        } finally {
            sample.stop(
                Timer.builder(MetricNames.GEMINI_CALL_DURATION)
                    .tag("call", call)
                    .tag("model", model)
                    .tag("outcome", outcome)
                    .publishPercentileHistogram()
                    .register(meterRegistry)
            )
        }
    }

    private fun recordTokenUsage(call: String, model: String, response: Map<*, *>) {
        val usage = response["usageMetadata"] as? Map<*, *> ?: return
        recordTokens(call, model, "prompt", (usage["promptTokenCount"] as? Number)?.toLong() ?: 0L)
        recordTokens(call, model, "candidates", (usage["candidatesTokenCount"] as? Number)?.toLong() ?: 0L)
        recordTokens(call, model, "total", (usage["totalTokenCount"] as? Number)?.toLong() ?: 0L)
    }

    private fun recordTokens(call: String, model: String, kind: String, count: Long) {
        if (count <= 0) return
        Counter.builder(MetricNames.GEMINI_TOKENS)
            .tag("call", call)
            .tag("model", model)
            .tag("kind", kind)
            .register(meterRegistry)
            .increment(count.toDouble())
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

            ## Additional Examples and Rules (accumulated from past evaluations)

            ### [PRONUNCIATION_OVERRIDE] Voiceless K/T rows → aspirated Korean (override 외래어 표기법)
            OVERRIDE the 외래어 표기법 word-initial rule for `koreanPronounciation`. Voiceless Japanese consonants must always be transcribed as aspirated Korean (ㅋ/ㅌ/ㅊ), regardless of word position. Voiced consonants stay non-aspirated.

            Mapping:
            - カ/キ/ク/ケ/コ → 카/키/쿠/케/코   (NOT 가/기/구/게/고)
            - タ/テ/ト → 타/테/토               (NOT 다/데/도)
            - チ → 치                           (NOT 지)
            - ツ → 츠                           (NOT 쓰)
            - ガ/ギ/グ/ゲ/ゴ → 가/기/구/게/고   (voiced — unchanged)
            - ダ/デ/ド → 다/데/도               (voiced — unchanged)
            - ジ → 지, ズ → 즈                  (voiced — unchanged)

            Few-shot (drawn from real lyrics):
            WRONG: くらげ (海月) → 구라게        /  RIGHT: 쿠라게
            WRONG: つき (月)   → 쓰키            /  RIGHT: 츠키
            WRONG: きみ (君)   → 기미            /  RIGHT: 키미
            WRONG: ただ        → 다다            /  RIGHT: 타다
            WRONG: きっと      → 깃토            /  RIGHT: 킷토
            WRONG: くち (口)   → 구치            /  RIGHT: 쿠치
            WRONG: なつ (夏)   → 나쓰            /  RIGHT: 나츠
            WRONG: たえず (絶えず) → 다에즈      /  RIGHT: 타에즈
            RIGHT (unchanged): あたま (頭) → 아타마   (mid-word た already aspirated by both rules)
            RIGHT (unchanged): だけ → 다케            (voiced だ → 다)
            RIGHT (unchanged): どう → 도우            (voiced ど → 도)
        """.trimIndent()

        /**
         * Word meaning prompt — kept in sync with playground
         * `prompt-eval/word-meaning/prompt/default.txt` + `additions/default.txt`.
         * Update both together when the playground prompt changes.
         */
        private val WORD_MEANING_PROMPT = """
            You are a Japanese-to-Korean vocabulary translator for flashcards.

            ## Input/Output
            Input: a JSON array of lyric lines. Each is `{"index": N, "words": [{"baseForm": "..."}]}`.
            Output: the same array, with each word as `{"baseForm": "...", "koreanText": "..."}`. JSON only.

            ## Rules
            1. Output every word in the input, in the same order. Output `words` count per line MUST equal input `words` count per line. NEVER skip, merge, split, or add entries.
            2. Copy `baseForm` verbatim from the input. Add `koreanText` only.
            3. `koreanText` = canonical Korean dictionary meaning of `baseForm`.
               - This output is for vocabulary flashcards. Translate the WORD in isolation, not its role in the sentence.
               - For polysemy: pick the most common dictionary sense.
               - For onomatopoeia (e.g. ザザザ, ズキズキ): use the natural Korean equivalent (e.g. 쏴아아아, 찌릿찌릿).
               - For katakana loanwords: use standard Korean transcription (e.g. ロンリー → 론리).

            Return ONLY the JSON array. No other text.

            ## Additional Examples and Rules (accumulated from past evaluations)

            ### [WRONG_MEANING] kanji baseForm: translate by MEANING, not by Korean音
            Many Japanese kanji words mean something different from the Korean音 (sound transliteration) of those kanji. When `baseForm` is in kanji, translate the actual meaning. NEVER fall back to Korean音.
            WRONG: 成敗 → 성패  (Korean音; actually means "punishment")
            RIGHT: 成敗 → 처벌
            WRONG: 無実 → 무실  (Korean音; not a meaningful Korean word in this sense)
            RIGHT: 無実 → 무죄
            WRONG: 狼狽 → 낭패  (낭패 ≠ 狼狽; actually means "panic/confusion")
            RIGHT: 狼狽 → 당황

            ### [STRUCTURAL] Do not merge adjacent words into one
            Each input `words` entry must produce one output entry. If two adjacent words form a compound (e.g. 誰+か = 누군가), distribute the meaning across both — do NOT collapse one's meaning into the other and leave the other empty.
            INPUT: [{"baseForm": "誰"}, {"baseForm": "か"}]
            WRONG: [{"koreanText": "누군가"}, {"koreanText": ""}]
            RIGHT: [{"koreanText": "누구"}, {"koreanText": "~인가"}]
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
                                "baseForm" to mapOf("type" to "STRING"),
                                "koreanText" to mapOf("type" to "STRING")
                            ),
                            "required" to listOf("baseForm", "koreanText")
                        )
                    )
                ),
                "required" to listOf("index", "words")
            )
        )
    }
}
