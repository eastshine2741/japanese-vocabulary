package com.japanese.vocabulary.lyricsearch

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class JapaneseLyricValidatorTest {

    @Test
    fun `japanese lyrics pass`() {
        assertThat(JapaneseLyricValidator.isJapaneseLyrics("夢ならばどれほどよかったでしょう\n未だにあなたのことを夢にみる")).isTrue()
    }

    @Test
    fun `english lyrics are rejected`() {
        assertThat(JapaneseLyricValidator.isJapaneseLyrics("I know I love you\nYou know you love me")).isFalse()
    }

    @Test
    fun `lyrics with an english translation glued to every line are rejected`() {
        val lyrics = """
            [00:12.30] 相槌が上手くなったんだ^You've gotten better at nodding along
            [00:16.80] 君の話を聞いていたら^When I was listening to you
            [00:21.10] 東京の夜は眩しくて^The Tokyo night is dazzling
        """.trimIndent()
        assertThat(JapaneseLyricValidator.isJapaneseLyrics(lyrics)).isFalse()
    }

    @Test
    fun `japanese lyrics with english hooks still pass`() {
        // K-pop 일본어판처럼 영어 후렴이 많아도 줄마다 번역을 붙인 형태가 아니면 통과한다.
        val lyrics = """
            Hey boy, look at me
            君の視線を感じてる
            Love dive, love dive
            心の奥まで飛び込んで
            実際の感情はNo Think!
            ^ ここだけ記号
        """.trimIndent()
        assertThat(JapaneseLyricValidator.isJapaneseLyrics(lyrics)).isTrue()
    }
}
