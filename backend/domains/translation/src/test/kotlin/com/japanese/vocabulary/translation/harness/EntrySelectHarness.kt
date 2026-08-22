package com.japanese.vocabulary.translation.harness

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.gemini.GeminiCallLogger
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.jisho.JishoClient
import com.japanese.vocabulary.translation.client.jisho.cache.JishoCache
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.model.AssembleAnalyzedLinesInput
import com.japanese.vocabulary.translation.model.SenseSelectionStageInput
import com.japanese.vocabulary.translation.model.SenseTranslationStageInput
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.model.WordPreparationResult
import com.japanese.vocabulary.translation.repository.GeminiCallLogRepository
import com.japanese.vocabulary.translation.service.JishoService
import com.japanese.vocabulary.translation.service.pipeline.JapaneseText
import com.japanese.vocabulary.translation.service.pipeline.LexicalResolver
import com.japanese.vocabulary.translation.service.pipeline.RuleMeaningProvider
import com.japanese.vocabulary.translation.service.pipeline.SegmentAnchoringValidator
import com.japanese.vocabulary.translation.service.pipeline.SenseTranslationPreparer
import com.japanese.vocabulary.translation.service.pipeline.stage.ApplyRuleMeaningsStage
import com.japanese.vocabulary.translation.service.pipeline.stage.AssembleAnalyzedLinesStage
import com.japanese.vocabulary.translation.service.pipeline.stage.ResolveLexicalSensesStage
import com.japanese.vocabulary.translation.service.pipeline.stage.SegmentLyricsStage
import com.japanese.vocabulary.translation.service.pipeline.stage.SelectSensesStage
import com.japanese.vocabulary.translation.service.pipeline.stage.TranslateLyricsStage
import com.japanese.vocabulary.translation.service.pipeline.stage.TranslateSensesStage
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.mockk
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfSystemProperty
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.web.client.RestClient
import java.io.File
import java.time.Duration

/**
 * Entry-select measurement harness — the one the plan's Step 9 asks for, run against the real
 * pipeline rather than a re-implementation of it.
 *
 * It calls the same stage objects [com.japanese.vocabulary.translation.service.KoreanLyricTranslationService]
 * calls, in the same order, but keeps every intermediate so it can report what the finished
 * `AnalyzedLine` no longer carries: which jisho provenance each token was graded, and whether
 * sense-select answered `-1`. Those two are AC10 and AC8; the rest are read off the assembled lines.
 *
 * It is skipped unless `-Dharness.input` names a directory, so a normal `:domains:translation:test`
 * never spends money. Golden lyrics are not committed (they are copyrighted); regenerate them from
 * the `lyrics` table — see `docs/architecture/song-analysis.md`.
 *
 * ```
 * cd backend && ./gradlew :domains:translation:test --tests '*EntrySelectHarness*' \
 *   -Dharness.input=/path/to/golden -Dharness.output=/path/to/out.json \
 *   -Dharness.segmentation.model=gemini-3.1-flash-lite \
 *   -Dharness.jisho.cache=/path/to/jisho-cache.json
 * ```
 */
@EnabledIfSystemProperty(named = "harness.input", matches = ".+")
class EntrySelectHarness {

    private val mapper: ObjectMapper = jacksonObjectMapper()

    @Test
    fun `measures entry-select quality on the golden songs`(): Unit = runBlocking {
        val inputDir = File(System.getProperty("harness.input"))
        val segmentationModel = System.getProperty("harness.segmentation.model", "gemini-3.1-flash-lite")
        val translationModel = System.getProperty("harness.translation.model", "gemini-3.1-pro-preview")
        val wordMeaningModel = System.getProperty("harness.word.model", "gemini-3.1-flash-lite")
        val cacheFile = System.getProperty("harness.jisho.cache")?.let(::File)
        // 0 = leave it to the model default, which is what `batch/application.yml` does today.
        val maxOutputTokens = System.getProperty("harness.max.output.tokens", "0").toInt()
        val thinkingLevel = System.getProperty("harness.thinking.level", "")  // segmentation only

        val registry = SimpleMeterRegistry()
        val jishoCache = FileBackedJishoCache(mapper, cacheFile)
        val pipeline = Pipeline(
            geminiClient = GeminiClient(
                restClientBuilder = restClientBuilder(),
                apiKey = requireNotNull(System.getenv("GEMINI_API_KEY")) { "GEMINI_API_KEY is not set" },
                translationModel = translationModel,
                wordMeaningModel = wordMeaningModel,
                segmentationModel = segmentationModel,
                maxOutputTokens = maxOutputTokens,
                segmentationThinkingLevel = thinkingLevel,
                objectMapper = mapper,
                meterRegistry = registry,
                geminiCallLogger = GeminiCallLogger(mockk<GeminiCallLogRepository>(relaxed = true)),
            ),
            jishoService = JishoService(JishoClient(restClientBuilder()), jishoCache),
        )

        val songs = inputDir.listFiles { f -> f.extension == "json" }.orEmpty().sortedBy { it.name }
        check(songs.isNotEmpty()) { "No golden lyric files in ${inputDir.absolutePath}" }

        val results = songs.map { file ->
            val golden = mapper.readValue<GoldenSong>(file)
            println("[harness] ${golden.profile} '${golden.title}' (${golden.lines.size} lines) @ $segmentationModel")
            val startedAt = System.currentTimeMillis()
            val outcome = pipeline.run(golden)
            jishoCache.flush()
            measure(golden, outcome, System.currentTimeMillis() - startedAt)
        }

        val report = mapOf(
            "segmentationModel" to segmentationModel,
            "translationModel" to translationModel,
            "wordMeaningModel" to wordMeaningModel,
            "maxOutputTokens" to maxOutputTokens,
            "segmentationThinkingLevel" to thinkingLevel,
            "songs" to results,
            "totals" to totals(results),
            "geminiTokens" to tokenUsage(registry),
        )
        val json = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(report)
        System.getProperty("harness.output")?.let { File(it).writeText(json) }
        println(json)
    }

    /**
     * The bootstrap modules get their [RestClient.Builder] from Spring Boot, which leaves the read
     * timeout unset. A bare `RestClient.builder()` instead picks up Reactor Netty's 10-second
     * default, which every `gemini-3.1-pro-preview` translation call blows through — so the
     * harness states the timeout rather than inheriting a default the real pipeline never sees.
     */
    private fun restClientBuilder(): RestClient.Builder = RestClient.builder()
        .requestFactory(
            JdkClientHttpRequestFactory().apply { setReadTimeout(Duration.ofMinutes(10)) },
        )

    /** The stage sequence of `KoreanLyricTranslationService.runPipeline`, with the intermediates kept. */
    private class Pipeline(geminiClient: GeminiClient, jishoService: JishoService) {
        private val translateLyrics = TranslateLyricsStage(geminiClient)
        private val segment = SegmentLyricsStage(geminiClient, SegmentAnchoringValidator())
        private val applyRules = ApplyRuleMeaningsStage(RuleMeaningProvider())
        private val resolveLexical = ResolveLexicalSensesStage(LexicalResolver(jishoService))
        private val selectSenses = SelectSensesStage(geminiClient)
        private val translateSenses = TranslateSensesStage(geminiClient, SenseTranslationPreparer())
        private val assemble = AssembleAnalyzedLinesStage()

        suspend fun run(golden: GoldenSong): Outcome {
            val source = TranslationPipelineSource.from(
                golden.lines,
                GeminiCallContext(songId = golden.songId, lyricId = golden.lyricId),
            )
            val (translationMap, wordPreparation) = coroutineScope {
                val translation = async { translateLyrics.execute(source) }
                val words = async { resolveLexical.execute(applyRules.execute(segment.execute(source))) }
                translation.await() to words.await()
            }
            val selected = selectSenses.execute(
                SenseSelectionStageInput(source, translationMap, wordPreparation),
            )
            val korean = translateSenses.execute(
                SenseTranslationStageInput(selected, wordPreparation.lexical, source.callContext),
            )
            val lines = assemble.execute(
                AssembleAnalyzedLinesInput(source, translationMap, wordPreparation, selected, korean),
            )
            return Outcome(wordPreparation, selected, lines)
        }
    }

    private class Outcome(
        val wordPreparation: WordPreparationResult,
        val selectedByKey: Map<PipelineTokenKey, Int>,
        val lines: List<AnalyzedLine>,
    )

    private fun measure(golden: GoldenSong, outcome: Outcome, elapsedMs: Long): Map<String, Any?> {
        val prep = outcome.wordPreparation
        val lexicalTokens = prep.tokensByIndex.values.flatten()
            .filter { JapaneseText.containsJapanese(it.surface) }
            .filterNot { prep.ruleResolvedByKey.containsKey(it.key) }

        // Provenance is graded per token, not per sense, so the first option carries it for all.
        val provenance = lexicalTokens.groupingBy { token ->
            prep.lexical.byTokenKey[token.key]?.options?.firstOrNull()?.provenance?.name ?: "NO_CANDIDATE"
        }.eachCount()
        // How many senses sense-select is actually asked to choose between. This is the number the
        // entry boundary is supposed to move: EXACT means different things before and after the
        // refactor, but "candidate senses per token" means the same thing in both.
        val candidateCounts = lexicalTokens.mapNotNull { token ->
            prep.lexical.byTokenKey[token.key]?.options?.size?.takeIf { it > 0 }
        }
        val exact = provenance[JishoLookupProvenance.EXACT.name] ?: 0
        val unselected = lexicalTokens.count { (outcome.selectedByKey[it.key] ?: -1) < 0 }

        val analyzed = outcome.lines.flatMap { it.tokens }
        val japanese = analyzed.filter { JapaneseText.containsJapanese(it.surface) }
        val jlptKnown = japanese.filter { it.jlpt != null }
        val inflectedReadings = japanese.count { it.reading != null && it.reading != it.baseFormReading }
        val hiraganaReadings = japanese.count { token ->
            listOfNotNull(token.reading, token.baseFormReading).any { it != JapaneseText.toKatakana(it) }
        }
        val badPronounciation = outcome.lines.count { line ->
            val text = line.pronounciation.orEmpty()
            text != JapaneseText.toKatakana(text) || text.any { it in '一'..'鿿' }
        }

        return mapOf(
            "profile" to golden.profile,
            "lyricId" to golden.lyricId,
            "title" to golden.title,
            "lines" to outcome.lines.size,
            "elapsedMs" to elapsedMs,
            "lexicalTokens" to lexicalTokens.size,
            "provenance" to provenance,
            "tokensWithCandidates" to candidateCounts.size,
            "meanSensesPerToken" to round(candidateCounts.average().takeIf { !it.isNaN() } ?: 0.0),
            "medianSensesPerToken" to (candidateCounts.sorted().getOrNull(candidateCounts.size / 2) ?: 0),
            "maxSensesPerToken" to (candidateCounts.maxOrNull() ?: 0),
            "tokensOver10Senses" to candidateCounts.count { it > 10 },
            "exactRatio" to ratio(exact, lexicalTokens.size),
            "unselectedRatio" to ratio(unselected, lexicalTokens.size), // AC8: senseId == -1
            "japaneseTokens" to japanese.size,
            "koreanNullRatio" to ratio(japanese.count { it.koreanText == null }, japanese.size), // AC9
            "jlptKnown" to jlptKnown.size,
            "n1Ratio" to ratio(jlptKnown.count { it.jlpt == "N1" }, jlptKnown.size), // AC11
            "inflectedReadingTokens" to inflectedReadings, // AC2
            "hiraganaReadingTokens" to hiraganaReadings, // AC3 violations
            "nonKatakanaPronounciationLines" to badPronounciation, // AC4 violations
        )
    }

    private fun totals(songs: List<Map<String, Any?>>): Map<String, Any?> {
        fun sum(key: String) = songs.sumOf { (it[key] as Number).toInt() }
        fun weighted(ratioKey: String, weightKey: String): Double {
            val weight = sum(weightKey)
            if (weight == 0) return 0.0
            val hits = songs.sumOf { (it[ratioKey] as Double) * (it[weightKey] as Number).toInt() }
            return round(hits / weight)
        }
        return mapOf(
            "lexicalTokens" to sum("lexicalTokens"),
            "meanSensesPerToken" to weighted("meanSensesPerToken", "tokensWithCandidates"),
            "tokensOver10Senses" to sum("tokensOver10Senses"),
            "exactRatio" to weighted("exactRatio", "lexicalTokens"),
            "unselectedRatio" to weighted("unselectedRatio", "lexicalTokens"),
            "koreanNullRatio" to weighted("koreanNullRatio", "japaneseTokens"),
            "n1Ratio" to weighted("n1Ratio", "jlptKnown"),
            "inflectedReadingTokens" to sum("inflectedReadingTokens"),
            "hiraganaReadingTokens" to sum("hiraganaReadingTokens"),
            "nonKatakanaPronounciationLines" to sum("nonKatakanaPronounciationLines"),
            "elapsedMs" to sum("elapsedMs"),
        )
    }

    private fun tokenUsage(registry: SimpleMeterRegistry): List<Map<String, Any?>> =
        registry.meters
            .filterIsInstance<io.micrometer.core.instrument.Counter>()
            .map { counter ->
                mapOf(
                    "call" to counter.id.getTag("call"),
                    "model" to counter.id.getTag("model"),
                    "kind" to counter.id.getTag("kind"),
                    "count" to counter.count().toLong(),
                )
            }
            .sortedBy { "${it["call"]}:${it["kind"]}" }

    private fun ratio(hits: Int, total: Int): Double = if (total == 0) 0.0 else round(hits.toDouble() / total)

    private fun round(value: Double): Double = Math.round(value * 10000.0) / 10000.0

    data class GoldenSong(
        val lyricId: Long,
        val songId: Long,
        val title: String,
        val artist: String,
        val profile: String,
        val lines: List<LyricLineData>,
    )

    /**
     * Stands in for Redis so the harness can be re-run without paying for the same jisho lookups
     * again. Persisted to disk between runs for the same reason — a model comparison runs the same
     * songs twice and the dictionary answers do not depend on the model.
     */
    private class FileBackedJishoCache(
        private val mapper: ObjectMapper,
        private val file: File?,
    ) : JishoCache(mockk<StringRedisTemplate>(relaxed = true), mapper) {
        private val entries: MutableMap<String, JishoEntryDto> = file
            ?.takeIf { it.isFile }
            ?.let { mapper.readValue<MutableMap<String, JishoEntryDto>>(it) }
            ?: mutableMapOf()

        override fun get(key: String): JishoEntryDto? = entries[key]

        override fun put(key: String, value: JishoEntryDto, ttl: Duration) {
            entries[key] = value
        }

        fun flush() = file?.writeText(mapper.writeValueAsString(entries))
    }
}
