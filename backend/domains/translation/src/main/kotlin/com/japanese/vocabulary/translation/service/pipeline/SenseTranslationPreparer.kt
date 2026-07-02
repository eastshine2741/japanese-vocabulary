package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.model.PipelineSenseOption
import org.springframework.stereotype.Component

@Component
class SenseTranslationPreparer {
    fun buildInput(
        senseIds: List<Int>,
        optionsById: Map<Int, PipelineSenseOption>,
    ): List<Map<String, Any?>> {
        return senseIds.mapNotNull { senseId ->
            val option = optionsById[senseId] ?: return@mapNotNull null
            mapOf(
                "senseId" to senseId,
                "surface" to option.surface,
                "baseForm" to option.baseForm,
                "reading" to option.reading,
                "pos" to option.partOfSpeech.name,
                "english" to option.english,
                "englishDefinitions" to option.englishDefinitions,
            )
        }
    }
}
