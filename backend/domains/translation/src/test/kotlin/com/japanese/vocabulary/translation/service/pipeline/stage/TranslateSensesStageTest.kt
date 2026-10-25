package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.translation.service.pipeline.stage.TranslateSensesStage.Companion.firstMeaning
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class TranslateSensesStageTest {

    @Test
    fun `keeps only the first comma-separated meaning`() {
        assertThat(firstMeaning("사랑, 애정")).isEqualTo("사랑")
        assertThat(firstMeaning("~에，~에게")).isEqualTo("~에")
    }

    @Test
    fun `keeps commas inside brackets`() {
        assertThat(firstMeaning("(사람, 물건이) 있다")).isEqualTo("(사람, 물건이) 있다")
        assertThat(firstMeaning("(사람, 물건이) 있다, 존재하다")).isEqualTo("(사람, 물건이) 있다")
    }

    @Test
    fun `skips a leading comma`() {
        assertThat(firstMeaning(", 사랑, 애정")).isEqualTo("사랑")
        assertThat(firstMeaning("수줍다")).isEqualTo("수줍다")
    }
}
