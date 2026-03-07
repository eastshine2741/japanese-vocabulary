package com.japanese.vocabulary.service

import com.japanese.vocabulary.model.*
import org.springframework.stereotype.Service

@Service
class LyricProcessingService {

    // Japanese punctuation and delimiter characters to split on
    private val DELIMITER_REGEX = Regex("[\\s\u3000\u3001\u3002\uff0c\uff0e\u30fb\uff01\uff1f\u300c\u300d\u300e\u300f\u3010\u3011\u2026\u30fc]+")

    fun analyze(title: String, artist: String, lyrics: String): SongStudyData {
        val song = Song(id = null, title = title, artist = artist, language = "ja")

        val lines = lyrics.lines()
        val nonEmptyLines = lines.filter { it.isNotBlank() }

        val studyUnits = nonEmptyLines.mapIndexed { index, line ->
            StudyUnit(
                index = index,
                originalText = line.trim()
            )
        }

        val vocabularyCandidates = extractVocabularyCandidates(nonEmptyLines)

        return SongStudyData(
            song = song,
            studyUnits = studyUnits,
            vocabularyCandidates = vocabularyCandidates
        )
    }

    private fun extractVocabularyCandidates(lines: List<String>): List<VocabularyCandidate> {
        val seen = mutableSetOf<String>()
        val candidates = mutableListOf<VocabularyCandidate>()

        lines.forEachIndexed { lineIndex, line ->
            val tokens = line.trim().split(DELIMITER_REGEX)
            tokens.forEach { token ->
                val cleaned = token.trim()
                // Include tokens >= 2 characters, skip already-seen words
                if (cleaned.length >= 2 && seen.add(cleaned)) {
                    candidates.add(
                        VocabularyCandidate(
                            word = cleaned,
                            reading = cleaned, // reading deferred to NLP enrichment
                            partOfSpeech = null,
                            sourceLineIndex = lineIndex
                        )
                    )
                }
            }
        }

        return candidates
    }
}
