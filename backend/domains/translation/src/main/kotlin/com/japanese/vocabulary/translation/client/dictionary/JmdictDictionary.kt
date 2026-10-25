package com.japanese.vocabulary.translation.client.dictionary

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryEntryDto
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupDto
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupProvenance
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionarySenseDto
import com.japanese.vocabulary.translation.service.pipeline.JapaneseText
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.sqlite.SQLiteConfig
import java.io.File
import java.sql.Connection
import java.sql.DriverManager

/**
 * Read-only lookups against the bundled JMdict SQLite file (built by `tools/dictionary/build_dictionary.py`),
 * answered as [DictionaryLookupDto] for [com.japanese.vocabulary.translation.service.pipeline.LexicalResolver].
 *
 * A query matches an entry when one of its spellings equals the query or one of its readings equals the query as
 * katakana. Every spelling/reading pair of a matched entry is returned.
 */
@Component
class JmdictDictionary(
    @Value("\${dictionary.path}") private val path: String,
    private val objectMapper: ObjectMapper,
) {
    // Opened on first lookup so contexts that never analyze a song (tests) boot without the file.
    private val connection: Connection by lazy {
        check(File(path).isFile) { "dictionary file not found: $path" }
        DriverManager.getConnection("jdbc:sqlite:$path", SQLiteConfig().apply { setReadOnly(true) }.toProperties())
    }

    @Synchronized
    fun lookup(word: String): DictionaryLookupDto {
        val seqs = matchingSeqs(word)
        if (seqs.isEmpty()) return DictionaryLookupDto(found = false, word = word, provenance = DictionaryLookupProvenance.NOT_FOUND)
        val entries = entriesOf(seqs)
        val forms = formsOf(seqs)
        return DictionaryLookupDto(
            found = true,
            word = word,
            entries = seqs.flatMap { seq ->
                val entry = entries.getValue(seq)
                forms[seq].orEmpty().mapNotNull { (headword, reading) ->
                    val kanaReading = reading.takeIf(JapaneseText::isKanaOnly)
                    if (headword == null && kanaReading == null) return@mapNotNull null
                    DictionaryEntryDto(headword = headword, reading = kanaReading, jlpt = entry.jlpt, senses = entry.senses)
                }
            },
            provenance = DictionaryLookupProvenance.EXACT,
        )
    }

    /** Most frequent entry first: rescues and sense-select prefer the first candidate. */
    private fun matchingSeqs(word: String): List<Long> =
        connection.prepareStatement(
            """
            SELECT f.seq FROM forms f JOIN entries e ON e.seq = f.seq
            WHERE f.headword = ? OR f.reading = ?
            GROUP BY f.seq ORDER BY MAX(e.zipf) DESC, f.seq
            """.trimIndent(),
        ).use { st ->
            st.setString(1, word)
            st.setString(2, JapaneseText.toKatakana(word))
            st.executeQuery().use { rs -> generateSequence { if (rs.next()) rs.getLong(1) else null }.toList() }
        }

    private fun entriesOf(seqs: List<Long>): Map<Long, Entry> =
        connection.prepareStatement("SELECT seq, senses, jlpt FROM entries WHERE seq IN (${placeholders(seqs)})").use { st ->
            seqs.forEachIndexed { i, seq -> st.setLong(i + 1, seq) }
            st.executeQuery().use { rs ->
                generateSequence {
                    if (!rs.next()) return@generateSequence null
                    rs.getLong(1) to Entry(
                        senses = objectMapper.readValue(rs.getString(2), Array<DictionarySenseDto>::class.java).toList(),
                        jlpt = objectMapper.readValue(rs.getString(3), Array<String>::class.java).toList(),
                    )
                }.toMap()
            }
        }

    private fun formsOf(seqs: List<Long>): Map<Long, List<Pair<String?, String>>> =
        connection.prepareStatement(
            "SELECT seq, headword, reading FROM forms WHERE seq IN (${placeholders(seqs)}) ORDER BY seq, ord",
        ).use { st ->
            seqs.forEachIndexed { i, seq -> st.setLong(i + 1, seq) }
            st.executeQuery().use { rs ->
                generateSequence { if (rs.next()) Triple(rs.getLong(1), rs.getString(2), rs.getString(3)) else null }
                    .groupBy({ it.first }, { it.second to it.third })
            }
        }

    private fun placeholders(seqs: List<Long>) = seqs.joinToString(",") { "?" }

    private data class Entry(val senses: List<DictionarySenseDto>, val jlpt: List<String>)
}
