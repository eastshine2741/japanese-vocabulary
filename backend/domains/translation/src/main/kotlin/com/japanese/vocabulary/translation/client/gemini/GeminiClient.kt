package com.japanese.vocabulary.translation.client.gemini

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.translation.client.gemini.dto.CorrLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.MeaningDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
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
    fun translateLyrics(lyricLines: List<Map<String, Any?>>): List<TranslationResultDto> {
        return callGemini(
            call = "translation",
            model = translationModel,
            systemPrompt = TRANSLATION_PROMPT,
            input = lyricLines,
            responseType = TranslationResultDto::class.java,
            temperature = 0.0,
            responseSchema = TRANSLATION_SCHEMA
        )
    }

    /**
     * L3 stage 1 — segmentation + lemmatization.
     * Input: [{index, text}] (raw lyric lines). Output: [{index, words:[{surface,dictionaryForm,reading}]}].
     * The LLM both segments and reduces each word to its dictionary headword (collapsing
     * potential/causative/passive forms), so criterion #1 (no derived lemmas) is satisfied here.
     * Replaces the dropped Kuromoji ensemble. Uses the lightweight model.
     */
    fun segmentAndLemmatize(lyricLines: List<Map<String, Any?>>): List<SegLineDto> {
        return callGemini(
            call = "segment",
            model = wordMeaningModel,
            systemPrompt = SEGMENTATION_PROMPT,
            input = lyricLines,
            responseType = SegLineDto::class.java,
            temperature = 0.0,
            responseSchema = SEGMENTATION_SCHEMA
        )
    }

    /**
     * L3 stage 2 — jisho-grounded Korean meaning per dictionary form.
     * Input: [{dictionaryForm, jishoPos, jishoSenses, jlpt}]. Output: [{dictionaryForm, koreanText}].
     * jisho EN senses + POS ground the translation; empty senses → model-knowledge fallback.
     */
    fun translateMeanings(words: List<Map<String, Any?>>): List<MeaningDto> {
        return callGemini(
            call = "meaning",
            model = wordMeaningModel,
            systemPrompt = MEANING_PROMPT,
            input = words,
            responseType = MeaningDto::class.java,
            temperature = 0.0,
            responseSchema = MEANING_SCHEMA
        )
    }

    /**
     * L3 correction pass — runs AFTER translation completes, using the finished Korean translation
     * as source-of-truth to fix (1) context-wrong meanings (single-kana homographs like ね→뿌리)
     * and (2) segmentation errors (ちゃん+と → ちゃんと).
     * Input: [{index, japanese, korean, words:[{surface,dictionaryForm,koreanText}]}].
     * Output: [{index, words:[{surface,dictionaryForm,koreanText}]}].
     */
    fun correctMeanings(lyricLines: List<Map<String, Any?>>): List<CorrLineDto> {
        return callGemini(
            call = "correction",
            model = wordMeaningModel,
            systemPrompt = CORRECTION_PROMPT,
            input = lyricLines,
            responseType = CorrLineDto::class.java,
            temperature = 0.0,
            responseSchema = CORRECTION_SCHEMA
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
         * L3 stage 1 — segmentation + lemmatization. Mirrors playground `run_l3.py` SEG_SYS verbatim.
         * Update both together when the playground prompt changes.
         */
        private val SEGMENTATION_PROMPT = """
            너는 일본어 가사를 형태소 분석(분절 + 표제형 환원)하는 전문가다.
            입력: JSON 배열, 각 원소는 {"index": N, "text": "일본어 가사 한 줄"}.
            출력: 같은 배열, 각 줄을 {"index": N, "words": [{"surface","dictionaryForm","reading"}]}로. JSON만.

            ## 규칙
            - surface: 원문에 나타난 그대로의 표면형(활용형 포함). 원문 순서대로 빠짐없이. 조사/조동사도 각각 하나의 word로.
            - dictionaryForm: 그 단어의 **사전 표제형(기본형)**. 활용·조동사·파생을 모두 환원한다.
              - 가능동사·가능형 → 원동사: 消せる→消す, 出会える→出会う, 飛び立てる→飛び立つ, 愛せる→愛す, なれる→なる, 言える→言う.
              - 사역/수동/~てしまう/~ている 등 보조성분 → 본동사 기본형: 紛らわせる→紛らわす, 見られる→見る.
              - 단, 진짜 下一段/上一段 동사(考える·捧げる·越える 등)는 가능형이 아니므로 그대로 둔다.
              - **결과에 "가능/사역/수동" 뉘앙스가 박힌 표제어가 있으면 안 된다.**
            - reading: dictionaryForm의 가타카나 요미가나.
        """.trimIndent()

        /**
         * L3 stage 2 — jisho-grounded Korean meaning. Mirrors playground `common.py` MEAN_SYS verbatim.
         */
        private val MEANING_PROMPT = """
            일본어 단어를 한국어 단어장(플래시카드)용으로 번역한다.
            입력: [{"dictionaryForm","jishoPos","jishoSenses"(영어 뜻 후보),"jlpt"}].
             jishoSenses가 비면 사전에 없는 것이니 네 지식으로 번역(fallback).
            출력: [{"dictionaryForm","koreanText"}] (입력과 1:1, 순서 동일). JSON만.

            규칙:
            - koreanText = dictionaryForm의 **정확하고 구체적인 한국어 사전 뜻**. jishoSenses(영어)가 있으면 그 뜻을 한국어로 옮기되, 여러 sense 중 가장 대표적/구체적 뉘앙스를 담아라(얕은 1차역 금지).
              예: 紛らわす jishoSenses=[divert / distract / relieve, conceal grief / shift conversation] → "(슬픔 등을) 딴 데로 돌려 잊다, 얼버무리다".
            - 품사별 한국어 형태 일관: VERB→"~다", I/NA형용사(형용동사 포함)→"~다"(명사형 금지, 好き→"좋아하다"), NOUN→명사, ADVERB→부사. jishoPos를 참고하되 dictionaryForm 기준.
            - 한자어는 한국 한자음이 아니라 실제 의미로.
        """.trimIndent()

        /**
         * L3 correction pass — translation-grounded correction. Mirrors playground `run_l3_correct.py`
         * SYS verbatim (the over-correction guard was deliberately rolled back to favor recall).
         */
        private val CORRECTION_PROMPT = """
            너는 일본어 가사 단어장(플래시카드)의 **교정기**다.
            각 줄에 대해: 일본어 원문(japanese), 그 줄의 완성된 한국어 번역(korean), 그리고 현재 분절된 단어 목록(words)을 받는다.
            **한국어 번역을 source of truth로 삼아** 단어들의 분절과 뜻을 교정하라.
            출력: 같은 배열, 각 줄을 {"index", "words":[{"surface","dictionaryForm","koreanText"}]}로. JSON만.

            ## 교정 1 — 문맥과 동떨어진 뜻
            번역은 그 줄에서 단어가 실제로 가진 sense/품사를 알려준다. koreanText가 다른 sense면 **맞는 sense의 사전형 뜻**으로 교체.
            - 예: ね가 "뿌리"(根)로 돼 있지만 문맥상 종조사 → "~네, ~지(종조사)".
            - 예: ほら가 "허풍"(法螺)으로 돼 있지만 문맥상 감동사 → "자!, 봐!(감동사)".
            - 단, **맞는 뜻을 문맥 활용형으로 바꾸지 말 것**(플래시카드 사전형 유지). **명백한 sense 오류만** 고친다.

            ## 교정 2 — 분절 오류
            잘못 쪼개졌거나 합쳐진 단어를 바로잡는다.
            - 잘못 분리 병합: ちゃん + と → 하나의 ちゃんと("제대로"). 인접 토큰이 사실 한 단어면 합쳐서 하나로.
            - 잘못 병합 분리: 두 단어가 한 토큰에 뭉쳐있으면 나눈다.
            - **제약**: 각 surface는 일본어 원문(japanese)에 실제로 나타난 부분문자열이어야 하고, 한 줄의 surface들을 순서대로 이으면 원문을 (공백 제외) 덮어야 한다. dictionaryForm은 사전 표제형, koreanText는 품사 일관(동사/형용사→~다, 명사→명사).

            바뀐 게 없으면 입력 그대로 출력. JSON 배열만 반환.
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

        private val SEGMENTATION_SCHEMA = mapOf(
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
                                "dictionaryForm" to mapOf("type" to "STRING"),
                                "reading" to mapOf("type" to "STRING")
                            ),
                            "required" to listOf("surface", "dictionaryForm", "reading")
                        )
                    )
                ),
                "required" to listOf("index", "words")
            )
        )

        private val MEANING_SCHEMA = mapOf(
            "type" to "ARRAY",
            "items" to mapOf(
                "type" to "OBJECT",
                "properties" to mapOf(
                    "dictionaryForm" to mapOf("type" to "STRING"),
                    "koreanText" to mapOf("type" to "STRING")
                ),
                "required" to listOf("dictionaryForm", "koreanText")
            )
        )

        private val CORRECTION_SCHEMA = mapOf(
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
                                "dictionaryForm" to mapOf("type" to "STRING"),
                                "koreanText" to mapOf("type" to "STRING")
                            ),
                            "required" to listOf("surface", "dictionaryForm", "koreanText")
                        )
                    )
                ),
                "required" to listOf("index", "words")
            )
        )
    }
}
