package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.client.gemini.GeminiClient
import com.japanese.vocabulary.song.dto.AnalyzedLine
import com.japanese.vocabulary.song.dto.Token
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.repository.LyricRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Pageable
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import java.time.Instant

@Service
class KoreanLyricTranslationService(
    private val lyricRepository: LyricRepository,
    private val morphologicalAnalyzer: MorphologicalAnalyzer,
    private val geminiClient: GeminiClient,
    private val transactionTemplate: TransactionTemplate
) {
    private val logger = LoggerFactory.getLogger("KoreanLyricTranslation")
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        private const val MAX_RETRIES = 3
        private const val BATCH_SIZE = 5
    }

    @Scheduled(fixedRate = 30_000)
    fun processTranslations() {
        logger.info("Polling for next translation batch...")

        val batch = transactionTemplate.execute {
            val entities = lyricRepository.findNextForTranslation(
                listOf(KoreanLyricStatus.PENDING),
                Pageable.ofSize(BATCH_SIZE)
            )
            if (entities.isNotEmpty()) {
                val now = Instant.now()
                entities.forEach { entity ->
                    logger.info("[songId={}] Status: {} → PROCESSING", entity.songId, entity.status)
                    entity.status = KoreanLyricStatus.PROCESSING
                    entity.updatedAt = now
                }
                lyricRepository.saveAllAndFlush(entities)
            }
            entities
        } ?: emptyList()

        if (batch.isEmpty()) {
            logger.info("No pending translations found")
            return
        }

        logger.info("Found {} songs to translate, dispatching to IO", batch.size)

        scope.launch {
            val results = batch.map { lyricEntity ->
                async { translateOne(lyricEntity) }
            }.awaitAll()

            val succeeded = results.count { it }
            val failed = results.size - succeeded
            logger.info("Batch complete: {} succeeded, {} failed out of {} total", succeeded, failed, results.size)
        }
    }

    private fun translateOne(lyricEntity: com.japanese.vocabulary.song.entity.LyricEntity): Boolean {
        logger.info(
            "[songId={}] Starting translation (retryCount={})",
            lyricEntity.songId, lyricEntity.retryCount
        )

        return try {
            // 1. Read rawContent (already deserialized by converter)
            val lyricLines = lyricEntity.rawContent
            logger.info("[songId={}] Parsed {} lyric lines", lyricEntity.songId, lyricLines.size)

            // 2. Tokenize each line with Sudachi
            val lineTokensMap = lyricLines.associate { line ->
                line.index to morphologicalAnalyzer.analyze(line.text)
            }

            // 3. Build Gemini input: lines with words
            val geminiInput = lyricLines.map { line ->
                val tokens = lineTokensMap[line.index] ?: emptyList()
                val words = tokens.map { token ->
                    mapOf("baseForm" to token.baseForm, "pos" to token.partOfSpeech)
                }
                mapOf(
                    "index" to line.index,
                    "text" to line.text,
                    "words" to words
                )
            }

            // 4. Call Gemini API
            logger.info("[songId={}] Calling Gemini API...", lyricEntity.songId)
            val translated = geminiClient.translateLyrics(geminiInput)
            logger.info("[songId={}] Gemini API responded ({} translated lines)", lyricEntity.songId, translated.size)

            if (translated.size != lyricLines.size) {
                logger.warn(
                    "[songId={}] Line count mismatch: expected={}, got={} — saving partial result",
                    lyricEntity.songId, lyricLines.size, translated.size
                )
            }

            // 5. Merge Sudachi tokens + Gemini koreanText → AnalyzedLine
            val translatedMap = translated.associateBy { it.index }
            val analyzedLines = lyricLines.map { line ->
                val tokens = lineTokensMap[line.index] ?: emptyList()
                val geminiLine = translatedMap[line.index]
                val wordMeanings = geminiLine?.words?.associateBy { it.baseForm } ?: emptyMap()

                val mergedTokens = tokens.map { tokenInfo ->
                    Token(
                        surface = tokenInfo.surface,
                        baseForm = tokenInfo.baseForm,
                        reading = tokenInfo.reading,
                        partOfSpeech = tokenInfo.partOfSpeech,
                        charStart = tokenInfo.charStart,
                        charEnd = tokenInfo.charEnd,
                        koreanText = wordMeanings[tokenInfo.baseForm]?.koreanText
                    )
                }

                AnalyzedLine(
                    index = line.index,
                    koreanLyrics = geminiLine?.koreanLyrics,
                    koreanPronounciation = geminiLine?.koreanPronounciation,
                    tokens = mergedTokens
                )
            }

            // 6. Save result (converter handles serialization)
            lyricEntity.analyzedContent = analyzedLines
            lyricEntity.status = KoreanLyricStatus.COMPLETED
            lyricEntity.updatedAt = Instant.now()
            lyricRepository.save(lyricEntity)
            logger.info("[songId={}] Status: PROCESSING → COMPLETED", lyricEntity.songId)
            true
        } catch (e: Exception) {
            lyricEntity.retryCount++
            if (lyricEntity.retryCount >= MAX_RETRIES) {
                lyricEntity.status = KoreanLyricStatus.FAILED
                lyricRepository.save(lyricEntity)
                logger.error(
                    "[songId={}] Translation failed (attempt {}/{}): {}",
                    lyricEntity.songId, lyricEntity.retryCount, MAX_RETRIES, e.message
                )
                logger.error("[songId={}] Status: PROCESSING → FAILED (max retries reached)", lyricEntity.songId)
            } else {
                lyricEntity.status = KoreanLyricStatus.PENDING
                lyricRepository.save(lyricEntity)
                logger.error(
                    "[songId={}] Translation failed (attempt {}/{}): {}",
                    lyricEntity.songId, lyricEntity.retryCount, MAX_RETRIES, e.message
                )
                logger.info("[songId={}] Status: PROCESSING → PENDING (will retry)", lyricEntity.songId)
            }
            false
        }
    }
}
