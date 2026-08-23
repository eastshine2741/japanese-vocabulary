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
    @Value("\${gemini.segmentation-model}") private val segmentationModel: String,
    @Value("\${gemini.max-output-tokens:0}") private val maxOutputTokens: Int,
    /**
     * Thinking level for the segmentation call only — `minimal` / `low` / `high`, or blank to leave
     * the model's own default alone.
     *
     * Blank is the default and sends no `thinkingConfig`, so the request body is unchanged for the
     * models this pipeline runs on today. It exists because the flash tiers above
     * `gemini-3.1-flash-lite` think by default and charge those thoughts to the same output budget as
     * the answer: a 20-line segmentation chunk stops at `finishReason=MAX_TOKENS` with the JSON array
     * barely started, even at `maxOutputTokens=32768`. It is scoped to segmentation because the
     * levels are not portable — `gemini-3.1-pro-preview`, which translates the lyrics, rejects
     * `minimal` outright.
     */
    @Value("\${gemini.segmentation-thinking-level:}") private val segmentationThinkingLevel: String,
    private val objectMapper: ObjectMapper,
    private val meterRegistry: MeterRegistry,
    private val geminiCallLogger: GeminiCallLogger,
) {
    private val restClient = restClientBuilder
        .baseUrl("https://generativelanguage.googleapis.com")
        .build()

    /**
     * Translate lyrics to Korean with pronunciation.
     * Input: [{index, text}] — no morphological data needed.
     * Uses the higher-quality model for natural translation.
     */
    fun translateLyrics(lyricLines: List<Map<String, Any?>>, context: GeminiCallContext): List<TranslationResultDto> {
        return callGemini(
            call = "translation",
            context = context,
            model = translationModel,
            systemPrompt = TRANSLATION_PROMPT,
            input = lyricLines,
            responseType = TranslationResultDto::class.java,
            temperature = 0.0,
            responseSchema = TRANSLATION_SCHEMA
        )
    }

    /**
     * Segmentation + lemmatization + readings + a context gloss.
     * Input: [{index, text}] (raw lyric lines).
     * Output: [{index, words:[{surface,headword,usedReading,baseFormReading,contextGloss}]}].
     *
     * The LLM segments by meaning units (keeping fixed adverbs/compounds whole) and reduces each word
     * to its dictionary headword (collapsing potential/causative/passive forms), so no derived lemma
     * reaches the dictionary. It also supplies both readings in katakana — `baseFormReading` is half
     * of the `(headword, reading)` key that pins down which jisho entry a homograph belongs to — and a
     * short English `contextGloss` that sense-select later matches against the dictionary glosses.
     *
     * Runs on its own model property: this stage now carries the whole pipeline's disambiguation
     * signal, so its tier is tuned separately from the cheaper downstream select/translate calls.
     *
     * [temperature] is the caller's, not a constant, because retries need it: see
     * [com.japanese.vocabulary.translation.service.pipeline.stage.SegmentLyricsStage].
     */
    fun segmentAndLemmatize(
        lyricLines: List<Map<String, Any?>>,
        context: GeminiCallContext,
        temperature: Double,
    ): List<SegLineDto> {
        return callGemini(
            call = "segment",
            context = context,
            model = segmentationModel,
            systemPrompt = SEGMENTATION_PROMPT,
            input = lyricLines,
            responseType = SegLineDto::class.java,
            temperature = temperature,
            responseSchema = SEGMENTATION_SCHEMA,
            thinkingLevel = segmentationThinkingLevel.takeIf { it.isNotBlank() }
        )
    }

    /**
     * Redesign stage 3 — per-line sense selection.
     * Input: [{index, japanese, korean, segments:[{tokenId,surface,headword,contextGloss,senses:[{senseId,english,pos}]}]}].
     * contextGloss is the segmentation stage's short English hint at this line's meaning; the model
     * matches it against the candidate glosses. Senses additionally carry headword/reading only when
     * the lookup stayed ambiguous across dictionary entries — there English glosses alone cannot
     * separate 前[マエ] from 前[ゼン].
     * Output: [{index, words:[{tokenId, senseId}]}].
     * The LLM uses the Korean translation as a context cue to pick the senseId that fits this line, or
     * -1 when none fits. It does NOT generate Korean meanings (blocks the over-correction failure mode).
     */
    fun selectSenses(lyricLines: List<Map<String, Any?>>, context: GeminiCallContext): List<SelectLineDto> {
        return callGemini(
            call = "select",
            context = context,
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
     * Input: [{senseId, surface, baseForm, reading, pos, english, englishDefinitions}].
     * Output: [{senseId, koreanText}].
     * POS-consistent, 1–2 comma-separated meanings; particles render as Korean particles (は→"~은/는").
     */
    fun translateSenses(senses: List<Map<String, Any?>>, context: GeminiCallContext): List<SenseTranslationDto> {
        if (senses.isEmpty()) return emptyList()
        return callGemini(
            call = "translate-sense",
            context = context,
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
        context: GeminiCallContext,
        model: String,
        systemPrompt: String,
        input: Any,
        responseType: Class<T>,
        temperature: Double,
        responseSchema: Map<String, Any>? = null,
        thinkingLevel: String? = null
    ): List<T> {
        val inputJson = objectMapper.writeValueAsString(input)

        val generationConfig = mutableMapOf<String, Any>(
            "responseMimeType" to "application/json",
            "temperature" to temperature
        )
        if (responseSchema != null) {
            generationConfig["responseSchema"] = responseSchema
        }
        if (maxOutputTokens > 0) {
            generationConfig["maxOutputTokens"] = maxOutputTokens
        }
        if (thinkingLevel != null) {
            generationConfig["thinkingConfig"] = mapOf("thinkingLevel" to thinkingLevel)
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
        var responseJson: String? = null
        var errorMessage: String? = null
        try {
            val response = restClient.post()
                .uri("/v1beta/models/{model}:generateContent?key={apiKey}", model, apiKey)
                .header("Content-Type", "application/json")
                .body(requestBody)
                .retrieve()
                .body(Map::class.java)
                ?: throw RuntimeException("Empty response from Gemini API")
            responseJson = runCatching { objectMapper.writeValueAsString(response) }.getOrNull()

            recordTokenUsage(call, model, response)
            GeminiResponseGuard.verifyComplete(call, model, response, maxOutputTokens)

            val text = extractText(response)

            return objectMapper.readValue(
                text,
                objectMapper.typeFactory.constructCollectionType(List::class.java, responseType)
            )
        } catch (e: Throwable) {
            outcome = "failure"
            errorMessage = "${e::class.simpleName}: ${e.message}"
            throw e
        } finally {
            geminiCallLogger.record(context, call, model, inputJson, responseJson, errorMessage)
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
            - Translate ALL lines in original order. Empty input → empty koreanLyrics.
            - Return ONLY a valid JSON array. No surrounding text.
            - Non-Japanese text (e.g., "1, 2, 3"): keep it as-is in koreanLyrics.

        """.trimIndent()

        /** Redesign stage 1 — segmentation + lemmatization for dictionary-grounded lookup. */
        private val SEGMENTATION_PROMPT = """
            너는 일본어 가사를 형태소 분석(분절 + 표제형 환원)하는 전문가다.
            입력: JSON 배열, 각 원소는 {"index": N, "text": "일본어 가사 한 줄"}.
            재시도 입력에는 각 원소에 previousValidationError와 retryInstruction이 추가될 수 있다.
            이 값은 그 줄의 직전 출력이 validator에서 왜 실패했는지 나타낸다. 해당 오류를 반드시 고쳐라.
            재시도 입력은 실패한 줄만 담고 있다. 입력에 있는 줄을 그 index 그대로 전부 출력하고,
            입력에 없는 줄을 새로 만들지 마라.
            출력: 같은 배열, 각 줄을
            {"index": N, "words": [{"surface","headword","usedReading","baseFormReading","contextGloss"}]}로. JSON만.

            ## 핵심 원칙
            단어장과 사전 조회에 쓸 분절이다. 하나의 word는 사전에서 따로 찾을 수 있는
            일본어 한 단어여야 한다. 뜻이 자연스럽다는 이유로 구나 절을 한 word로 묶지 마라.

            ## 분절 규칙
            - 조사/조동사/어미는 앞 단어에 붙이지 말고 따로 분리한다. は, を, が, の, に, で, まで, も, か, って는 별도 word다.
            - 동사·형용사·명사·부사는 각각 따로 찾을 수 있는 한 단어 단위로 분리한다.
            - 이미 사전 한 단어인 복합어는 유지한다. 단어 여러 개가 만든 구는 분리한다.
            - **단어 2개가 붙은 형태는 2개로 쪼갠다.** 사전에서 그 결합 자체를 표제어로 찾을 수 없으면 잘못 묶은 것이다.
              쪼갠 각 조각은 자기 headword를 갖고, surface를 순서대로 이으면 원문과 같아야 한다.
              - 부정의 ない/なくて/なすぎ: 長くない → 長く / ない, わからない → わから / ない, そうでもない → そう / でも / ない
              - 보조동사 ていく·てくる·てしまう·てみる와 그 축약형(~てった, ~てって): 置いてった → 置いて / った, 飛んでった → 飛んで / った
              - 정도·희망 등의 접미 성분: わからなすぎ → わから / なすぎ, 見たい → 見 / たい
              - 사전 표제어가 아닌 복합명사: 納豆巻き → 納豆 / 巻き
              보조 성분의 headword는 그 보조어의 사전형이다: った → いく, なすぎ → ない, たい → たい.
            - **일본어 단어만 출력한다.** 공백·구두점·따옴표·라틴 문자·숫자는 word로 만들지 마라.
              서버가 원문에서 위치로 되읽으므로 출력할 필요가 없다.
              특히 원문에 없는 공백을 단어 구분자로 끼워 넣지 마라. 그러면 뒤에 있는 진짜 공백과 어긋나
              그 줄 전체의 위치 정렬이 깨진다.

            ## 예시
            - 上手くいって → 上手く / いって
            - どうしようか → どう / しよう / か
            - 長くない → 長く(長い) / ない(ない)
            - わからない → わから(わかる) / ない(ない)
            - 置いてった → 置いて(置く) / った(いく)
            - 打たれ弱い → 打たれ(打つ) / 弱い(弱い)
            - 何の為 → 何 / の / 為
            - どこかで → どこか / で
            - 行く宛 → 行く / 宛
            - 飛び立つ → 飛び立つ
            - 「それでも」って → それでも / って  (따옴표는 출력하지 않는다)
            - 涼しい風吹く 青空の匂い → 涼しい / 風 / 吹く / 青空 / の / 匂い  (공백은 출력하지 않는다)
            - 「　　　　」 → words: []  (일본어 단어가 없는 줄은 빈 배열)

            ## 출력 규칙
            - surface: 원문에 나타난 그대로의 표면형(활용형 포함). **원문을 그대로 잘라낸 부분문자열**이어야 한다.
              원문 등장 순서를 지키고, 원문의 일본어 부분을 하나도 빠뜨리지 않는다.
              공백·기호는 출력하지 않으니 surface 사이에 그만큼의 틈이 생기는 것은 정상이다.
            - headword: 그 word 하나의 사전 표제형. 조사/조동사를 붙인 구 형태를 headword로 만들지 마라.
              - **headword 자체가 두 단어의 결합이면 분절이 틀린 것이다**: 長くない, わからない, 置いていく, 飛んでいく, そうでもない은 headword가 될 수 없다.
              - 가능동사·가능형 → 원동사: 消せる→消す, 出会える→出会う, 飛び立てる→飛び立つ, 愛せる→愛す, なれる→なる, 言える→言う.
              - 사역/수동/~てしまう/~ている 등 보조성분 → 본동사 기본형: 紛らわせる→紛らわす, 見られる→見る.
              - しよう→する, いって/行って→行く, 上手く→上手い 또는 上手, ろ(〜たろ)→だろう.
              - 단, 진짜 下一段/上一段 동사(考える·捧げる·越える 등)는 가능형이 아니므로 그대로 둔다.
              - **결과에 "가능/사역/수동" 뉘앙스가 박힌 표제어가 있으면 안 된다.**
            - usedReading: 그 줄에서 실제로 읽히는 발음. **가타카나로만** 쓴다. 활용형은 활용형 그대로의 발음이다.
              - 行って → イッテ, 高く → タカク, 消せる → ケセル.
            - baseFormReading: headword의 사전 발음. **가타카나로만** 쓴다.
              - 行く → イク, 高い → タカイ, 消す → ケス.
              - **동음이의어를 가르는 값이다.** 前(먼저/이전)는 マエ, 前(앞 접두)는 ゼン이다.
                문맥에 맞는 쪽을 골라라. 여기가 틀리면 사전에서 엉뚱한 표제어를 집는다.
            - 발음 표기: 장음은 `ー`가 아니라 실제 모음으로 쓴다(どう → ドウ, とうきょう → トウキョウ).
              촉음 `ッ`와 발음 `ン`은 그대로 쓴다. 한자·히라가나를 발음 필드에 남기지 마라.
            - contextGloss: 이 줄에서 그 단어가 가지는 뜻의 영어 힌트. 2~4단어의 짧은 영어.
              사전 정의를 옮겨 적는 것이 아니라, 여러 뜻 중 어느 갈래인지만 구별되면 된다.
              - 前(まえ, 시간적 이전) → "before, earlier", 前(ぜん, 앞쪽) → "front, forward"
              - 上手い(솜씨가 좋다) → "skillful, good at"
        """.trimIndent()

        /**
         * Redesign stage 3 — per-line sense selection. Mirrors playground `run_redesign.py` SELECT_SYS verbatim.
         */
        private val SELECT_PROMPT = """
            너는 일본어 가사 단어장(플래시카드)의 **뜻 선택기**다.
            각 줄마다: 일본어 원문(japanese), 그 줄의 한국어 번역(korean), 분절된 단어들(segments)을 받는다.
            각 segment에는 tokenId, contextGloss, 그리고 그 단어(headword)의 사전 뜻 후보
            senses=[{senseId, english(영어 뜻), pos(품사)}]가 들어있다.
            contextGloss는 그 단어가 이 줄에서 가지는 뜻의 짧은 영어 힌트다.
            **contextGloss와 한국어 번역을 문맥 단서로** 삼아, 각 단어가 이 줄에서 실제로 가지는 뜻에 해당하는 senseId 하나를 고른다.
            senses 중 contextGloss와 뜻이 가장 가까운 것 하나를 고르면 된다.
            출력: 같은 배열, 각 줄을 {"index", "words":[{"tokenId","senseId"}]}로. JSON만.

            ## 규칙
            - senseId: 그 segment의 senses 중 이 문맥에 가장 맞는 것의 senseId. **반드시 주어진 senses에 있는 값**이어야 한다.
            - 일부 sense에는 headword와 reading이 붙어 있다. 이는 그 뜻이 어느 사전 표제어의 것인지 나타낸다.
              영어 뜻이 서로 비슷해 보여도 headword/reading이 다르면 **다른 단어**다. 문맥에 맞는 표제어 쪽을 골라라.
            - senses가 비어있거나(사전에 없음) 어느 것도 문맥에 맞지 않으면 senseId = -1.
            - 한국어 뜻을 직접 만들지 마라. **오직 senseId 선택만** 한다.
            - words는 입력 segments와 1:1, 순서 동일. tokenId는 입력 그대로 복사한다.
              surface와 headword는 출력하지 마라.
            - 입력에 있는 줄을 그 index 그대로 **전부** 출력한다. 중간에 멈추지 마라.
        """.trimIndent()

        /**
         * Redesign stage 4 — translate chosen English senses. Mirrors playground `run_redesign.py` TRANSLATE_SYS verbatim.
         */
        private val TRANSLATE_PROMPT = """
            일본어 단어의 **영어 사전 뜻(englishDefinitions)** 을 한국어 단어장(플래시카드)용으로 번역한다.
            입력: [{"senseId","baseForm","reading","pos"(품사),"english","englishDefinitions"}]. 출력: [{"senseId","koreanText"}] (입력과 1:1, 순서 동일). JSON만.

            규칙:
            - koreanText = 주어진 Japanese sense의 **정확하고 구체적인 한국어 사전 뜻**. baseForm/reading은 어떤 일본어 단어의 뜻인지 확인하기 위한 정체성 단서다.
            - **sense 하나에 한국어 뜻 하나.** englishDefinitions에 여러 gloss가 있어도 그것들이 공유하는 핵심 뜻을 파악해 **가장 자연스러운 한 개**만 쓴다.
              유의어를 나열하지 마라 — 이 문자열은 단어장에서 뜻 목록으로 쪼개지므로, 비슷한 말을 덧붙이면 같은 뜻이 여러 개로 저장된다.
              예: english "shy" → "수줍다" (X: "수줍은, 부끄러움을 타는"), "head over heels / headlong / head first" → "곤두박질".
            - 한 뜻을 표현하는 데 쉼표가 필요한 경우가 아니면 쉼표(,)를 쓰지 마라. 슬래시(/)는 쓰지 마라.
              괄호로 대상을 한정하는 것은 뜻 하나다: "(사람, 물건이) 있다".
            - 품사 일관: 동사/형용사(형용동사 포함)→"~다"(명사형 금지, 好き→"좋아하다"), 명사→명사, 부사→부사.
            - **pos가 PARTICLE(조사)면** 영어 설명("indicates the subject" 등)을 그대로 옮기지 말고, **같은 기능의 한국어 조사로** 번역한다. 문장에 끼워도 자연스러운 조사 형태로. 예: は→"~은/는", が→"~이/가", を→"~을/를", の→"~의", に→"~에, ~에게", へ→"~으로", と→"~와/과, ~라고", も→"~도", から→"~부터, ~에서", まで→"~까지", で→"~에서, ~로", や→"~이나".
              조사는 대응하는 한국어 조사 형태를 병기하는 것이 사전 표기이므로, 위 예시처럼 두 형태를 쉼표로 잇는 것은 허용한다. 조사가 아닌 단어는 뜻 하나다.
            - 한자어는 한국 한자음이 아니라 실제 의미로. english 그대로의 뜻만 옮기고 새 뜻을 지어내지 마라.
        """.trimIndent()

        private val TRANSLATION_SCHEMA = mapOf(
            "type" to "ARRAY",
            "items" to mapOf(
                "type" to "OBJECT",
                "properties" to mapOf(
                    "index" to mapOf("type" to "INTEGER"),
                    "koreanLyrics" to mapOf("type" to "STRING")
                ),
                "required" to listOf("index", "koreanLyrics")
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
                                "headword" to mapOf("type" to "STRING"),
                                "usedReading" to mapOf("type" to "STRING"),
                                "baseFormReading" to mapOf("type" to "STRING"),
                                "contextGloss" to mapOf("type" to "STRING")
                            ),
                            "required" to listOf(
                                "surface",
                                "headword",
                                "usedReading",
                                "baseFormReading",
                                "contextGloss"
                            )
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
                                "tokenId" to mapOf("type" to "STRING"),
                                "senseId" to mapOf("type" to "INTEGER")
                            ),
                            "required" to listOf("tokenId", "senseId")
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
