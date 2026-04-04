package com.japanese.vocabulary.config

import com.japanese.vocabulary.song.service.*
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary

@Configuration
class MorphologicalAnalyzerConfig {

    @Bean("kuromoji")
    fun kuromojiAnalyzer(): KuromojiMorphologicalAnalyzer =
        KuromojiMorphologicalAnalyzer()

    @Bean("kuromoji-unidic")
    fun kuromojiUnidicAnalyzer(): KuromojiUnidicMorphologicalAnalyzer =
        KuromojiUnidicMorphologicalAnalyzer()

    @Bean("kuromoji-ensemble")
    @Primary
    fun kuromojiEnsembleAnalyzer(
        kuromoji: KuromojiMorphologicalAnalyzer,
        kuromojiUnidic: KuromojiUnidicMorphologicalAnalyzer
    ): MorphologicalAnalyzer =
        KuromojiEnsembleAnalyzer(kuromoji, kuromojiUnidic)
}
