package com.japanese.vocabulary.translation.service.pipeline

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class JapaneseTextTest {

    @Test
    fun `converts hiragana to katakana`() {
        assertThat(JapaneseText.toKatakana("まえ")).isEqualTo("マエ")
        assertThat(JapaneseText.toKatakana("いって")).isEqualTo("イッテ")
        assertThat(JapaneseText.toKatakana("たかい")).isEqualTo("タカイ")
    }

    @Test
    fun `leaves katakana kanji latin and symbols untouched`() {
        assertThat(JapaneseText.toKatakana("マエ")).isEqualTo("マエ")
        assertThat(JapaneseText.toKatakana("前")).isEqualTo("前")
        assertThat(JapaneseText.toKatakana("Lucky 7")).isEqualTo("Lucky 7")
        assertThat(JapaneseText.toKatakana("「　」")).isEqualTo("「　」")
    }

    @Test
    fun `keeps the prolonged sound mark and small kana`() {
        assertThat(JapaneseText.toKatakana("きっと")).isEqualTo("キット")
        assertThat(JapaneseText.toKatakana("メッセージ")).isEqualTo("メッセージ")
    }

    @Test
    fun `accepts kana-only readings in either script`() {
        assertThat(JapaneseText.isKanaOnly("マエ")).isTrue
        assertThat(JapaneseText.isKanaOnly("まえ")).isTrue
        assertThat(JapaneseText.isKanaOnly("メッセージ")).isTrue
        assertThat(JapaneseText.isKanaOnly("キット")).isTrue
    }

    @Test
    fun `treats only characters that are actually pronounced as Japanese`() {
        assertThat(JapaneseText.containsJapanese("猫")).isTrue
        assertThat(JapaneseText.containsJapanese("ねこ")).isTrue
        assertThat(JapaneseText.containsJapanese("ネコ")).isTrue
        assertThat(JapaneseText.containsJapanese("ﾈｺ")).isTrue // half-width
        assertThat(JapaneseText.containsJapanese("人々")).isTrue
        assertThat(JapaneseText.containsJapanese("々")).isTrue // read aloud, though outside every kana block
    }

    @Test
    fun `does not treat katakana-block punctuation as Japanese`() {
        // These sit inside the katakana Unicode block but have no reading. Calling them Japanese makes
        // the anchoring validator demand a reading that nothing can supply and no kana check can
        // accept, which deadlocks the retry loop and fails the whole song — `ロックン・ロール` did exactly
        // that.
        assertThat(JapaneseText.containsJapanese("・")).isFalse
        assertThat(JapaneseText.containsJapanese("゠")).isFalse
        assertThat(JapaneseText.containsJapanese("ヿ")).isFalse
        assertThat(JapaneseText.containsJapanese("ﾞ")).isFalse // half-width dakuten, same class as ・
        assertThat(JapaneseText.containsJapanese("ﾟ")).isFalse
        assertThat(JapaneseText.containsJapanese("「」 yay 123")).isFalse
        assertThat(JapaneseText.containsJapanese("、。")).isFalse
    }

    @Test
    fun `every character it calls Japanese can carry a kana reading`() {
        // The invariant behind the two predicates: anything containsJapanese admits must be something a
        // reading can be produced for, or SegmentAnchoringValidator can never satisfy both.
        val readable = ((0x3000..0x30FF) + (0xFF66..0xFF9F))
            .map { it.toChar() }
            .filter { JapaneseText.containsJapanese(it.toString()) }

        assertThat(readable).isNotEmpty
        assertThat(readable).noneMatch { it in listOf('・', '゠', 'ヿ', '゛', '゜', 'ﾞ', 'ﾟ') }
    }

    @Test
    fun `rejects anything that is not purely kana`() {
        assertThat(JapaneseText.isKanaOnly("")).isFalse
        assertThat(JapaneseText.isKanaOnly("前")).isFalse
        assertThat(JapaneseText.isKanaOnly("行った")).isFalse // kanji mixed in
        assertThat(JapaneseText.isKanaOnly("Lucky")).isFalse
        assertThat(JapaneseText.isKanaOnly("マエ ")).isFalse // trailing space
        assertThat(JapaneseText.isKanaOnly("、")).isFalse
    }
}
