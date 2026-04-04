package com.japanese.vocabulary.song.service

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class AnalyzerRegistry(analyzers: Map<String, MorphologicalAnalyzer>) {

    private val logger = LoggerFactory.getLogger(AnalyzerRegistry::class.java)

    private val displayOrder = listOf("kuromoji-ensemble", "kuromoji", "kuromoji-unidic")

    private val registry: LinkedHashMap<String, MorphologicalAnalyzer> = linkedMapOf<String, MorphologicalAnalyzer>().apply {
        for (name in displayOrder) {
            analyzers[name]?.let { put(name, it) }
        }
        // any unrecognized analyzers at the end
        for ((name, analyzer) in analyzers) {
            if (!containsKey(name)) put(name, analyzer)
        }
        logger.info("Registered analyzers: ${keys}")
    }

    fun get(name: String): MorphologicalAnalyzer? = registry[name]

    fun availableNames(): Set<String> = registry.keys
}
