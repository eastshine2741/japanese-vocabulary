package com.japanese.autoconfigure.translation

import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.jisho.JishoClient
import com.japanese.vocabulary.translation.client.jisho.cache.JishoCache
import com.japanese.vocabulary.translation.service.JishoService
import com.japanese.vocabulary.translation.service.KoreanLyricTranslationService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.Import

@AutoConfiguration
@Import(
    GeminiClient::class,
    JishoClient::class,
    JishoCache::class,
    JishoService::class,
    KoreanLyricTranslationService::class,
)
class TranslationAutoConfiguration
