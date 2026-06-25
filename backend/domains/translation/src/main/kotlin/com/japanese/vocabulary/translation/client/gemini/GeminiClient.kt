package com.japanese.vocabulary.translation.client.gemini

import org.springframework.stereotype.Component
import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SenseTranslationDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import org.springframework.beans.factory.annotation.Value
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
     * Redesign stage 1 — segmentation + lemmatization (meaning-aware, no reading).
     * Input: [{index, text}] (raw lyric lines). Output: [{index, words:[{surface,dictionaryForm}]}].
     * The LLM segments by meaning units (keeping fixed adverbs/compounds whole) and reduces each word
     * to its dictionary headword (collapsing potential/causative/passive forms), so criterion #1
     * (no derived lemmas) is satisfied here. Replaces the dropped Kuromoji ensemble. Lightweight model.
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
     * Redesign stage 3 — per-line sense selection.
     * Input: [{index, japanese, korean, segments:[{surface, dictionaryForm, senses:[{senseId,english,pos}]}]}].
     * Output: [{index, words:[{surface, dictionaryForm, senseId}]}].
     * The LLM uses the Korean translation as a context cue to pick the senseId that fits this line, or
     * -1 when none fits. It does NOT generate Korean meanings (blocks the over-correction failure mode).
     */
    fun selectSenses(lyricLines: List<Map<String, Any?>>): List<SelectLineDto> {
        return callGemini(
            call = "select",
            model = wordMeaningModel,
            systemPrompt = SELECT_PROMPT,
            input = lyricLines,
            responseType = SelectLineDto::class.java,
            temperature = 0.0,
            responseSchema = SELECT_SCHEMA
        )
    }

    /**
     * Redesign stage 4 — translate the chosen English senses to Korean.
     * Input: [{senseId, pos, english}] (unique chosen senses). Output: [{senseId, koreanText}].
     * POS-consistent, 1–2 comma-separated meanings; particles render as Korean particles (は→"~은/는").
     */
    fun translateSenses(senses: List<Map<String, Any?>>): List<SenseTranslationDto> {
        if (senses.isEmpty()) return emptyList()
        return callGemini(
            call = "translate-sense",
            model = wordMeaningModel,
            systemPrompt = TRANSLATE_PROMPT,
            input = senses,
            responseType = SenseTranslationDto::class.java,
            temperature = 0.0,
            responseSchema = TRANSLATE_SCHEMA
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
         * Redesign stage 1 — segmentation + lemmatization. Mirrors playground `run_redesign.py` SEG_SYS
         * verbatim. Update both together when the playground prompt changes.
         */
        private val SEGMENTATION_PROMPT = """
            너는 일본어 가사를 형태소 분석(분절 + 표제형 환원)하는 전문가다.
            입력: JSON 배열, 각 원소는 {"index": N, "text": "일본어 가사 한 줄"}.
            출력: 같은 배열, 각 줄을 {"index": N, "words": [{"surface","dictionaryForm"}]}로. JSON만.

            ## 핵심 원칙: 의미 단위로 분절하라
            기계적으로 글자를 쪼개지 말고, **그 줄의 의미를 먼저 이해한 뒤** 사전에 한 표제어로 실리는 단위를 하나의 word로 묶어라.
            - **부사·연어·관용표현은 통째로 한 단어**다. 조사처럼 생긴 끝글자(と·に·て 등)가 붙어 있어도 쪼개지 마라.
              - ちゃんと(제대로), きっと(분명), ずっと(쭉), やっと(겨우), そっと(살며시), もっと(더), わざと(일부러), ふと(문득) → 각각 하나의 word. ちゃん+と, きっ+と처럼 나누면 안 된다.
              - 何時も·いつも, どうして, なんだか, とにかく 등 부사/연어도 하나로.
            - 복합동사(飛び立つ, 巡り会う, 弾き出す)·복합명사도 한 단어로 묶는다. 의미가 한 덩어리면 쪼개지 않는다.

            ## 분절 규칙
            - surface: 원문에 나타난 그대로의 표면형(활용형 포함). 원문 순서대로 빠짐없이. 표면형들을 순서대로 이으면 (공백/기호 제외) 원문을 덮어야 한다.
            - 진짜 조사/조동사(は·を·が·の·で·た·ない·ている 등)는 각각 하나의 word로 분리. (단 위의 부사/연어와 혼동하지 말 것.)
            - dictionaryForm: 그 단어의 **사전 표제형(기본형)**. 활용·조동사·파생을 모두 환원한다.
              - 가능동사·가능형 → 원동사: 消せる→消す, 出会える→出会う, 飛び立てる→飛び立つ, 愛せる→愛す, なれる→なる, 言える→言う.
              - 사역/수동/~てしまう/~ている 등 보조성분 → 본동사 기본형: 紛らわせる→紛らわす, 見られる→見る.
              - 단, 진짜 下一段/上一段 동사(考える·捧げる·越える 등)는 가능형이 아니므로 그대로 둔다.
              - **결과에 "가능/사역/수동" 뉘앙스가 박힌 표제어가 있으면 안 된다.**
              - 부사/연어는 그 자체가 표제형이다(ちゃんと→ちゃんと).
        """.trimIndent()

        /**
         * Redesign stage 3 — per-line sense selection. Mirrors playground `run_redesign.py` SELECT_SYS verbatim.
         */
        private val SELECT_PROMPT = """
            너는 일본어 가사 단어장(플래시카드)의 **뜻 선택기**다.
            각 줄마다: 일본어 원문(japanese), 그 줄의 한국어 번역(korean), 분절된 단어들(segments)을 받는다.
            각 segment에는 그 단어(dictionaryForm)의 사전 뜻 후보 senses=[{senseId, english(영어 뜻), pos(품사)}]가 들어있다.
            **한국어 번역을 문맥 단서로** 삼아, 각 단어가 이 줄에서 실제로 가지는 뜻에 해당하는 senseId 하나를 고른다.
            출력: 같은 배열, 각 줄을 {"index", "words":[{"surface","dictionaryForm","senseId"}]}로. JSON만.

            ## 규칙
            - senseId: 그 segment의 senses 중 이 문맥에 가장 맞는 것의 senseId. **반드시 주어진 senses에 있는 값**이어야 한다.
            - senses가 비어있거나(사전에 없음) 어느 것도 문맥에 맞지 않으면 senseId = -1.
            - 한국어 뜻을 직접 만들지 마라. **오직 senseId 선택만** 한다.
            - words는 입력 segments와 1:1, 순서 동일. surface/dictionaryForm는 입력 그대로 복사.
        """.trimIndent()

        /**
         * Redesign stage 4 — translate chosen English senses. Mirrors playground `run_redesign.py` TRANSLATE_SYS verbatim.
         */
        private val TRANSLATE_PROMPT = """
            일본어 단어의 **영어 사전 뜻(english)** 을 한국어 단어장(플래시카드)용으로 번역한다.
            입력: [{"senseId","pos"(품사),"english"(영어 뜻)}]. 출력: [{"senseId","koreanText"}] (입력과 1:1, 순서 동일). JSON만.

            규칙:
            - koreanText = 주어진 english sense의 **정확하고 구체적인 한국어 사전 뜻**. 여러 영어 정의가 묶여 있어도 **가장 대표적인 뜻 1~2개만** 골라 옮긴다(전부 나열 금지, 얕은 1차역도 금지).
            - 뜻이 2개면 **쉼표(,)로 구분**한다. 슬래시(/)는 쓰지 마라. 예: "제대로, 확실히".
            - 품사 일관: 동사/형용사(형용동사 포함)→"~다"(명사형 금지, 好き→"좋아하다"), 명사→명사, 부사→부사.
            - **pos가 PARTICLE(조사)면** 영어 설명("indicates the subject" 등)을 그대로 옮기지 말고, **같은 기능의 한국어 조사로** 번역한다. 문장에 끼워도 자연스러운 조사 형태로. 예: は→"~은/는", が→"~이/가", を→"~을/를", の→"~의", に→"~에, ~에게", へ→"~으로", と→"~와/과, ~라고", も→"~도", から→"~부터, ~에서", まで→"~까지", で→"~에서, ~로", や→"~이나".
            - 한자어는 한국 한자음이 아니라 실제 의미로. english 그대로의 뜻만 옮기고 새 뜻을 지어내지 마라.
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
                                "dictionaryForm" to mapOf("type" to "STRING")
                            ),
                            "required" to listOf("surface", "dictionaryForm")
                        )
                    )
                ),
                "required" to listOf("index", "words")
            )
        )

        private val SELECT_SCHEMA = mapOf(
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
                                "senseId" to mapOf("type" to "INTEGER")
                            ),
                            "required" to listOf("surface", "dictionaryForm", "senseId")
                        )
                    )
                ),
                "required" to listOf("index", "words")
            )
        )

        private val TRANSLATE_SCHEMA = mapOf(
            "type" to "ARRAY",
            "items" to mapOf(
                "type" to "OBJECT",
                "properties" to mapOf(
                    "senseId" to mapOf("type" to "INTEGER"),
                    "koreanText" to mapOf("type" to "STRING")
                ),
                "required" to listOf("senseId", "koreanText")
            )
        )
    }
}
