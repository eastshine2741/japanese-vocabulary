package com.japanese.vocabulary.translation.service.pipeline.stage

interface PipelineStage<I, O> {
    suspend fun execute(input: I): O
}
