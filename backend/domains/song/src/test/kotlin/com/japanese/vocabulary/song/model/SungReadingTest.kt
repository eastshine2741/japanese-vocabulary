package com.japanese.vocabulary.song.model

import com.japanese.vocabulary.song.model.PartOfSpeech.ADVERB
import com.japanese.vocabulary.song.model.PartOfSpeech.CONJUNCTION
import com.japanese.vocabulary.song.model.PartOfSpeech.EXPRESSION
import com.japanese.vocabulary.song.model.PartOfSpeech.INTERJECTION
import com.japanese.vocabulary.song.model.PartOfSpeech.NOUN
import com.japanese.vocabulary.song.model.PartOfSpeech.OTHER
import com.japanese.vocabulary.song.model.PartOfSpeech.PARTICLE
import com.japanese.vocabulary.song.model.PartOfSpeech.VERB
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SungReadingTest {

    private fun sung(surface: String, pos: PartOfSpeech, reading: String?, previous: Char? = null) =
        SungReading.of(surface, pos, reading, previous)

    @Test
    fun `reads every は and へ of a particle as it is sung`() {
        assertThat(sung("は", PARTICLE, "ハ")).isEqualTo("ワ")
        assertThat(sung("へ", PARTICLE, "ヘ")).isEqualTo("エ")
        assertThat(sung("までは", PARTICLE, "マデハ")).isEqualTo("マデワ")
        assertThat(sung("へと", PARTICLE, "ヘト")).isEqualTo("エト")
        assertThat(sung("を", PARTICLE, "ヲ")).isEqualTo("ヲ") // ヲ and オ both read 오
    }

    /** Whatever the tag, a final hiragana は is the topic particle. Only that one: はじめまして keeps ハ. */
    @Test
    fun `reads a trailing topic は as it is sung whatever the part of speech`() {
        assertThat(sung("には", EXPRESSION, "ニハ")).isEqualTo("ニワ")
        assertThat(sung("それでは", CONJUNCTION, "ソレデハ")).isEqualTo("ソレデワ")
        assertThat(sung("見たのは", VERB, "ミタノハ")).isEqualTo("ミタノワ")
        assertThat(sung("実は", EXPRESSION, "ジツハ")).isEqualTo("ジツワ")
        assertThat(sung("まずは", ADVERB, "マズハ")).isEqualTo("マズワ")
        assertThat(sung("では", OTHER, "デハ")).isEqualTo("デワ")
        assertThat(sung("はじめまして", EXPRESSION, "ハジメマシテ")).isEqualTo("ハジメマシテ")
    }

    @Test
    fun `keeps the ハ of laughter`() {
        assertThat(sung("あっはっは", OTHER, "アッハッハ")).isEqualTo("アッハッハ")
        assertThat(sung("ははは", OTHER, "ハハハ")).isEqualTo("ハハハ")
        assertThat(sung("あは", INTERJECTION, "アハ")).isEqualTo("アハ")
    }

    /** The model's reading of a kana word sometimes takes the next token's kana or loses a mora. */
    @Test
    fun `reads a kana surface as it is spelled`() {
        assertThat(sung("の", PARTICLE, "ノガ")).isEqualTo("ノ")
        assertThat(sung("こと", NOUN, "コトハ")).isEqualTo("コト")
        assertThat(sung("まったく", ADVERB, "マッタクト")).isEqualTo("マッタク")
        assertThat(sung("はーい", OTHER, "ハイ")).isEqualTo("ハーイ")
    }

    /** Same length means the model only wrote a sound differently from the spelling, as it is sung. */
    @Test
    fun `keeps a kana reading of the same length as the surface`() {
        assertThat(sung("ではない", EXPRESSION, "デワナイ")).isEqualTo("デワナイ")
        assertThat(sung("とはいえ", CONJUNCTION, "トワイエ")).isEqualTo("トワイエ")
        assertThat(sung("いう", VERB, "ユウ")).isEqualTo("ユウ")
        assertThat(sung("はぁ", INTERJECTION, "ハア")).isEqualTo("ハア")
    }

    @Test
    fun `keeps the model's reading of a surface spelled in archaic kana`() {
        assertThat(sung("こゑ", NOUN, "コエ")).isEqualTo("コエ")
    }

    @Test
    fun `keeps the ハ of a word that really ends in は`() {
        assertThat(sung("いろは", NOUN, "イロハ")).isEqualTo("イロハ")
    }

    @Test
    fun `never keeps a hiragana reading`() {
        assertThat(sung("最低", NOUN, "さいてい")).isEqualTo("サイテイ")
    }

    @Test
    fun `reads 時 after a number as a counter`() {
        assertThat(sung("時", NOUN, "トキ", previous = '8')).isEqualTo("ジ")
        assertThat(sung("時", NOUN, "トキ", previous = '８')).isEqualTo("ジ")
        assertThat(sung("時", NOUN, "トキ", previous = 'の')).isEqualTo("トキ")
        assertThat(sung("時", NOUN, "トキ")).isEqualTo("トキ")
    }

    @Test
    fun `leaves a missing reading missing`() {
        assertThat(sung("は", PARTICLE, null)).isNull()
    }
}
