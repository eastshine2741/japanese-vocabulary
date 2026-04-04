package com.japanese.vocabulary.song.controller

import com.japanese.vocabulary.song.dto.TokenInfo
import com.japanese.vocabulary.song.service.AnalyzerRegistry
import com.japanese.vocabulary.song.service.MorphologicalAnalyzer
import org.slf4j.LoggerFactory
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/dev")
class DevController(
    private val morphologicalAnalyzer: MorphologicalAnalyzer,
    private val analyzerRegistry: AnalyzerRegistry
) {

    private val logger = LoggerFactory.getLogger(DevController::class.java)

    data class LineInput(val index: Int, val text: String)

    data class WordOutput(val baseForm: String, val pos: String)

    data class LineOutput(val index: Int, val text: String, val words: List<WordOutput>)

    @PostMapping("/morphological-analyze")
    fun analyze(@RequestBody lines: List<LineInput>): List<LineOutput> {
        return lines.map { line ->
            val tokens = morphologicalAnalyzer.analyze(line.text)
            val words = tokens.map { token ->
                WordOutput(baseForm = token.baseForm, pos = token.partOfSpeech.name)
            }
            LineOutput(index = line.index, text = line.text, words = words)
        }
    }

    // --- Morphological comparison API ---

    private val ANALYZER_DISPLAY_NAMES = mapOf(
        "sudachi" to "Sudachi (UniDic core)",
        "sudachi-full" to "Sudachi (UniDic full)",
        "kuromoji" to "Kuromoji (IPADic)",
        "kuromoji-unidic" to "Kuromoji (UniDic)",
        "kagome" to "Kagome (IPADic)",
        "mecab-neologd" to "MeCab (NEologd)"
    )

    data class CompareRequest(
        val lines: List<LineInput>,
        val analyzers: List<String>? = null
    )

    data class TokenOutput(
        val surface: String,
        val baseForm: String,
        val reading: String?,
        val baseFormReading: String?,
        val partOfSpeech: String,
        val charStart: Int,
        val charEnd: Int
    )

    data class AnalyzedLineOutput(
        val index: Int,
        val tokens: List<TokenOutput>,
        val latencyMs: Long
    )

    data class AnalyzerResult(
        val displayName: String,
        val lines: List<AnalyzedLineOutput>?,
        val error: String?
    )

    data class CompareResponse(val results: Map<String, AnalyzerResult>)

    @GetMapping("/analyzers")
    fun listAnalyzers(): Set<String> = analyzerRegistry.availableNames()

    @PostMapping("/morphological-compare")
    fun compare(@RequestBody request: CompareRequest): CompareResponse {
        val analyzerNames = request.analyzers?.takeIf { it.isNotEmpty() }
            ?: analyzerRegistry.availableNames().toList()

        val results = analyzerNames.associateWith { name ->
            val analyzer = analyzerRegistry.get(name)
            if (analyzer == null) {
                AnalyzerResult(
                    displayName = ANALYZER_DISPLAY_NAMES[name] ?: name,
                    lines = null,
                    error = "Analyzer not found: $name"
                )
            } else {
                try {
                    val lines = request.lines.map { line ->
                        val start = System.currentTimeMillis()
                        val tokens = analyzer.analyze(line.text)
                        val latencyMs = System.currentTimeMillis() - start
                        AnalyzedLineOutput(
                            index = line.index,
                            tokens = tokens.map { it.toOutput() },
                            latencyMs = latencyMs
                        )
                    }
                    AnalyzerResult(
                        displayName = ANALYZER_DISPLAY_NAMES[name] ?: name,
                        lines = lines,
                        error = null
                    )
                } catch (e: Exception) {
                    logger.warn("Analyzer '$name' failed: ${e.message}")
                    AnalyzerResult(
                        displayName = ANALYZER_DISPLAY_NAMES[name] ?: name,
                        lines = null,
                        error = e.message ?: "Unknown error"
                    )
                }
            }
        }

        return CompareResponse(results = results)
    }

    private fun TokenInfo.toOutput() = TokenOutput(
        surface = surface,
        baseForm = baseForm,
        reading = reading,
        baseFormReading = baseFormReading,
        partOfSpeech = partOfSpeech.name,
        charStart = charStart,
        charEnd = charEnd
    )
}
