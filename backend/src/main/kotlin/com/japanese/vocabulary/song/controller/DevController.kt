package com.japanese.vocabulary.song.controller

import com.japanese.vocabulary.song.service.MorphologicalAnalyzer
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/dev")
class DevController(
    private val morphologicalAnalyzer: MorphologicalAnalyzer
) {

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
}
