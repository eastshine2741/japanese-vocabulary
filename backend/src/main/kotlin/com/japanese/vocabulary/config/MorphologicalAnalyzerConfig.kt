package com.japanese.vocabulary.config

import com.japanese.vocabulary.song.service.*
import com.worksap.nlp.sudachi.Config
import com.worksap.nlp.sudachi.Dictionary
import com.worksap.nlp.sudachi.DictionaryFactory
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.web.reactive.function.client.WebClient
import java.io.File

@Configuration
class MorphologicalAnalyzerConfig(
    @Value("\${analyzer.kagome.url:http://localhost:6060}") private val kagomeUrl: String,
    @Value("\${analyzer.mecab-neologd.url:http://localhost:8089}") private val mecabUrl: String
) {

    private val logger = LoggerFactory.getLogger(MorphologicalAnalyzerConfig::class.java)

    @Bean("sudachi")
    @Primary
    fun sudachiAnalyzer(sudachiDictionary: Dictionary): MorphologicalAnalyzer =
        SudachiMorphologicalAnalyzer(sudachiDictionary)

    @Bean("sudachi-full")
    fun sudachiFullAnalyzer(): MorphologicalAnalyzer? {
        // Find full dict next to core dict
        val coreResource = javaClass.classLoader.getResource("sudachi/system_core.dic")
        if (coreResource == null) {
            logger.info("sudachi-full: cannot locate core dict, skipping")
            return null
        }
        val fullFile = File(coreResource.toURI()).parentFile.resolve("system_full.dic")
        if (!fullFile.exists()) {
            logger.info("sudachi-full: {} not found, skipping", fullFile.absolutePath)
            return null
        }
        logger.info("sudachi-full: loading dictionary from {}", fullFile.absolutePath)
        try {
            val dictionary = DictionaryFactory().create(
                Config.defaultConfig().systemDictionary(fullFile.toPath())
            )
            return SudachiMorphologicalAnalyzer(dictionary)
        } catch (e: Exception) {
            logger.error("sudachi-full: failed to load dictionary", e)
            return null
        }
    }

    @Bean("kuromoji")
    fun kuromojiAnalyzer(): MorphologicalAnalyzer =
        KuromojiMorphologicalAnalyzer()

    @Bean("kuromoji-unidic")
    fun kuromojiUnidicAnalyzer(): MorphologicalAnalyzer =
        KuromojiUnidicMorphologicalAnalyzer()

    @Bean("kagome")
    fun kagomeAnalyzer(webClientBuilder: WebClient.Builder): MorphologicalAnalyzer =
        KagomeMorphologicalAnalyzer(kagomeUrl, webClientBuilder)

    @Bean("mecab-neologd")
    fun mecabNeologdAnalyzer(webClientBuilder: WebClient.Builder): MorphologicalAnalyzer =
        MeCabNeologdMorphologicalAnalyzer(mecabUrl, webClientBuilder)
}
