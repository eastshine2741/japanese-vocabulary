package com.japanese.vocabulary.translation.client.dictionary

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupProvenance
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import java.sql.DriverManager

/** Runs against a tiny SQLite file with the schema `tools/dictionary/build_dictionary.py` writes. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class JmdictDictionaryTest {
    private lateinit var dir: Path
    private lateinit var dictionary: JmdictDictionary

    @BeforeAll
    fun buildFile(@TempDir tempDir: Path) {
        dir = tempDir
        val path = dir.resolve("jmdict.sqlite").toString()
        DriverManager.getConnection("jdbc:sqlite:$path").use { db ->
            db.createStatement().use { st ->
                st.executeUpdate("CREATE TABLE entries (seq INTEGER PRIMARY KEY, senses TEXT NOT NULL, jlpt TEXT NOT NULL, zipf REAL)")
                st.executeUpdate("CREATE TABLE forms (seq INTEGER NOT NULL, ord INTEGER NOT NULL, headword TEXT, reading TEXT NOT NULL, PRIMARY KEY (seq, ord))")
                // 前[まえ] is the common entry, 前[ぜん] the rare one
                st.executeUpdate("INSERT INTO entries VALUES (1, '${senses("before", "Noun")}', '[\"jlpt-n5\"]', 5.5)")
                st.executeUpdate("INSERT INTO entries VALUES (2, '${senses("former", "Prefix")}', '[]', 3.1)")
                st.executeUpdate("INSERT INTO entries VALUES (3, '${senses("message", "Noun")}', '[]', NULL)")
                st.executeUpdate("INSERT INTO entries VALUES (4, '${senses("word", "Noun")}', '[]', 4.0)")
                st.executeUpdate("INSERT INTO forms VALUES (1, 0, '前', 'マエ')")
                st.executeUpdate("INSERT INTO forms VALUES (2, 0, '前', 'ゼン')")
                st.executeUpdate("INSERT INTO forms VALUES (3, 0, NULL, 'メッセージ')")
                st.executeUpdate("INSERT INTO forms VALUES (4, 0, '言', 'ゲン')")
                st.executeUpdate("INSERT INTO forms VALUES (4, 1, '言', 'コト')")
            }
        }
        dictionary = JmdictDictionary(path, ObjectMapper())
    }

    @Test
    fun `entries sharing a spelling are all returned, most frequent first`() {
        val result = dictionary.lookup("前")

        assertThat(result.found).isTrue()
        assertThat(result.provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(result.entries.map { it.headword to it.reading }).containsExactly("前" to "マエ", "前" to "ゼン")
        assertThat(result.entries.first().jlpt).containsExactly("jlpt-n5")
        assertThat(result.entries.first().senses.single().pos).containsExactly("Noun")
    }

    @Test
    fun `each spelling-reading pair of an entry becomes its own dictionary entry`() {
        val result = dictionary.lookup("言")

        assertThat(result.entries.map { it.headword to it.reading }).containsExactly("言" to "ゲン", "言" to "コト")
        assertThat(result.entries.map { it.senses }).allSatisfy { assertThat(it.single().english).isEqualTo("word") }
    }

    @Test
    fun `a hiragana query matches a reading`() {
        val result = dictionary.lookup("こと")

        assertThat(result.entries.map { it.headword to it.reading }).containsExactly("言" to "ゲン", "言" to "コト")
    }

    @Test
    fun `a kana-only entry has no headword`() {
        val result = dictionary.lookup("メッセージ")

        assertThat(result.entries.single().headword).isNull()
        assertThat(result.entries.single().reading).isEqualTo("メッセージ")
    }

    @Test
    fun `an unknown word is a genuine not-found`() {
        val result = dictionary.lookup("ゑゐ")

        assertThat(result.found).isFalse()
        assertThat(result.provenance).isEqualTo(DictionaryLookupProvenance.NOT_FOUND)
    }

    @Test
    fun `a missing file fails the lookup instead of answering not-found`() {
        val missing = JmdictDictionary(dir.resolve("absent.sqlite").toString(), ObjectMapper())

        assertThatThrownBy { missing.lookup("前") }.isInstanceOf(IllegalStateException::class.java)
    }

    private fun senses(english: String, pos: String) =
        """[{"pos": ["$pos"], "english": "$english", "englishDefinitions": ["$english"]}]"""
}
