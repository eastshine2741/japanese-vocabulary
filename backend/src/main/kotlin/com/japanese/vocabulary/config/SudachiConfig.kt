package com.japanese.vocabulary.config

import com.worksap.nlp.sudachi.Config
import com.worksap.nlp.sudachi.Dictionary
import com.worksap.nlp.sudachi.DictionaryFactory
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.io.File
import java.nio.file.Path

@Configuration
class SudachiConfig(
    @Value("\${sudachi.dictionary-path:}") private val dictionaryPath: String
) {

    private val logger = LoggerFactory.getLogger(SudachiConfig::class.java)

    @Bean
    fun sudachiDictionary(): Dictionary {
        val dictPath = resolveDictionaryPath()
        logger.info("Loading Sudachi dictionary from: $dictPath")

        val config = Config.defaultConfig()
            .systemDictionary(dictPath)

        return DictionaryFactory().create(config)
    }

    private fun resolveDictionaryPath(): Path {
        if (dictionaryPath.isNotBlank()) {
            val path = Path.of(dictionaryPath)
            require(path.toFile().exists()) { "Sudachi dictionary not found at: $dictionaryPath" }
            return path
        }

        // Try classpath
        val resource = javaClass.classLoader.getResource("sudachi/system_core.dic")
        if (resource != null) {
            return File(resource.toURI()).toPath()
        }

        throw IllegalStateException(
            "Sudachi dictionary not found. Set SUDACHI_DICT_PATH environment variable " +
                "or place system_core.dic in src/main/resources/sudachi/"
        )
    }
}
