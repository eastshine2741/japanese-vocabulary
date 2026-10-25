package com.japanese.vocabulary.song.service

import com.atilika.kuromoji.ipadic.Tokenizer
import java.text.Normalizer

/**
 * Compares a Japanese artist name with a Latin-script channel name by consonants alone. Romanization
 * varies in its vowels (ou/o/oh, the vowel a loanword drops: マグネタイト ↔ magnetite) far more than in
 * its consonants, and r/l is one sound in Japanese (バルーン ↔ Balloon).
 */
object RomanizedName {
    private val tokenizer by lazy { Tokenizer() }

    /** Consonant skeleton of the name's reading, or null when a part has no known reading. */
    fun skeleton(name: String): String? {
        val text = Normalizer.normalize(name, Normalizer.Form.NFKC)
        val reading = StringBuilder()
        for (token in tokenizer.tokenize(text)) {
            val surface = token.surface
            when {
                surface.all { it.isLatinLetterOrDigit() } -> reading.append(latinSkeleton(surface))
                surface.all { it.isKana() } -> reading.append(kanaSkeleton(toKatakana(surface)))
                surface.isBlank() || surface.all { !it.isLetterOrDigit() } -> Unit
                else -> {
                    val kana = token.reading?.takeIf { it != "*" } ?: return null
                    reading.append(kanaSkeleton(kana))
                }
            }
        }
        return collapse(reading.toString())
    }

    fun latinSkeleton(text: String): String =
        collapse(
            text.lowercase()
                .replace(Regex("""m(?=[bpm])"""), "n")
                .filter { it in 'a'..'z' && it !in VOWELS }
                .replace('l', 'r'),
        )

    private fun kanaSkeleton(katakana: String): String {
        val out = StringBuilder()
        for (ch in katakana) {
            when {
                ch == 'ッ' || ch == 'ー' -> Unit
                ch in SMALL_Y -> if (!out.endsWith("sh") && !out.endsWith("ch") && !out.endsWith("j")) out.append('y')
                else -> out.append(KANA_CONSONANT[ch] ?: "")
            }
        }
        return out.toString()
    }

    private fun collapse(s: String): String = s.replace(Regex("""(.)\1+"""), "$1")

    private fun toKatakana(text: String): String =
        text.map { if (it in 'ぁ'..'ゖ') it + ('ァ' - 'ぁ') else it }.joinToString("")

    private fun Char.isKana(): Boolean = this in 'ぁ'..'ゖ' || this in 'ァ'..'ヺ' || this == 'ー'

    private fun Char.isLatinLetterOrDigit(): Boolean = this in 'a'..'z' || this in 'A'..'Z' || this in '0'..'9'

    private const val VOWELS = "aeiou"
    private val SMALL_Y = setOf('ャ', 'ュ', 'ョ')

    // Hepburn consonants; vowel-only kana map to nothing.
    private val KANA_CONSONANT: Map<Char, String> = buildMap {
        fun row(consonants: List<String>, kana: String) = kana.forEachIndexed { i, k -> put(k, consonants[i]) }
        row(List(5) { "" }, "アイウエオ")
        row(List(5) { "" }, "ァィゥェォ")
        row(listOf("k", "k", "k", "k", "k"), "カキクケコ")
        row(listOf("g", "g", "g", "g", "g"), "ガギグゲゴ")
        row(listOf("s", "sh", "s", "s", "s"), "サシスセソ")
        row(listOf("z", "j", "z", "z", "z"), "ザジズゼゾ")
        row(listOf("t", "ch", "ts", "t", "t"), "タチツテト")
        row(listOf("d", "j", "z", "d", "d"), "ダヂヅデド")
        row(listOf("n", "n", "n", "n", "n"), "ナニヌネノ")
        row(listOf("h", "h", "f", "h", "h"), "ハヒフヘホ")
        row(listOf("b", "b", "b", "b", "b"), "バビブベボ")
        row(listOf("p", "p", "p", "p", "p"), "パピプペポ")
        row(listOf("m", "m", "m", "m", "m"), "マミムメモ")
        row(listOf("y", "y", "y"), "ヤユヨ")
        row(listOf("r", "r", "r", "r", "r"), "ラリルレロ")
        row(listOf("w", "", "", "", "n"), "ワヰヱヲン")
        put('ヴ', "v")
    }
}
