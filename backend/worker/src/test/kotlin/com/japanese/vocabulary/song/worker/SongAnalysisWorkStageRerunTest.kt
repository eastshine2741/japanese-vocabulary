package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage.ANALYZE_LYRICS
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage.COMPLETE
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage.FETCH_LYRICS
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage.FETCH_YOUTUBE
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage.SELECT_SENSES
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage.TRANSLATE_SENSES
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SongAnalysisWorkStageRerunTest {

    @Test
    fun `a stage reruns with every stage that reads its output`() {
        assertThat(FETCH_YOUTUBE.rerunScope()).containsExactlyInAnyOrder(FETCH_YOUTUBE, COMPLETE)
        assertThat(FETCH_LYRICS.rerunScope()).containsExactlyInAnyOrder(FETCH_LYRICS, ANALYZE_LYRICS, SELECT_SENSES, TRANSLATE_SENSES, COMPLETE)
        assertThat(SELECT_SENSES.rerunScope()).containsExactlyInAnyOrder(SELECT_SENSES, TRANSLATE_SENSES, COMPLETE)
        assertThat(COMPLETE.rerunScope()).containsExactly(COMPLETE)
    }

    @Test
    fun `stages outside the scope that the scope reads are inherited, except the MV`() {
        assertThat(SELECT_SENSES.inheritedInputs()).containsExactlyInAnyOrder(FETCH_LYRICS, ANALYZE_LYRICS)
        assertThat(COMPLETE.inheritedInputs()).containsExactlyInAnyOrder(FETCH_LYRICS, ANALYZE_LYRICS, SELECT_SENSES, TRANSLATE_SENSES)
        assertThat(FETCH_LYRICS.inheritedInputs()).isEmpty()
        assertThat(FETCH_YOUTUBE.inheritedInputs()).isEmpty()
    }

    @Test
    fun `the next stage skips stages outside the scope`() {
        assertThat(FETCH_YOUTUBE.nextIn(FETCH_YOUTUBE.rerunScope())).isEqualTo(COMPLETE)
        assertThat(FETCH_LYRICS.nextIn(FETCH_LYRICS.rerunScope())).isEqualTo(ANALYZE_LYRICS)
        assertThat(FETCH_LYRICS.nextIn(null)).isEqualTo(FETCH_YOUTUBE)
    }
}
