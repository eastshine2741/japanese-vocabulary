package com.japanese.vocabulary.song.model

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class KoreanMeaningTest {

    @Test
    fun `keeps only the first comma-separated meaning`() {
        assertThat(KoreanMeaning.first("사랑, 애정")).isEqualTo("사랑")
        assertThat(KoreanMeaning.first("~에，~에게")).isEqualTo("~에")
    }

    @Test
    fun `keeps commas inside brackets`() {
        assertThat(KoreanMeaning.first("(사람, 물건이) 있다")).isEqualTo("(사람, 물건이) 있다")
        assertThat(KoreanMeaning.first("(사람, 물건이) 있다, 존재하다")).isEqualTo("(사람, 물건이) 있다")
    }

    @Test
    fun `skips a leading comma`() {
        assertThat(KoreanMeaning.first(", 사랑, 애정")).isEqualTo("사랑")
        assertThat(KoreanMeaning.first("수줍다")).isEqualTo("수줍다")
    }
}
