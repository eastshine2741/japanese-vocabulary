package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.client.gemini.GeminiClient
import com.japanese.vocabulary.song.dto.AnalyzedLine
import com.japanese.vocabulary.song.dto.Token
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.repository.LyricRepository
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Pageable
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.concurrent.CompletableFuture

@Service
class KoreanLyricTranslationService(
    private val lyricRepository: LyricRepository,
    private val morphologicalAnalyzer: MorphologicalAnalyzer,
    private val geminiClient: GeminiClient
) {
    private val logger = LoggerFactory.getLogger("KoreanLyricTranslation")

    companion object {
        private const val MAX_RETRIES = 3
        private const val BATCH_SIZE = 5
    }

    @Scheduled(fixedDelay = 30_000)
    fun processTranslations() {
        logger.info("Polling for next translation batch...")

        val batch = lyricRepository.findNextForTranslation(
            listOf(KoreanLyricStatus.PENDING, KoreanLyricStatus.PROCESSING),
            Pageable.ofSize(BATCH_SIZE)
        )

        if (batch.isEmpty()) {
            logger.info("No pending translations found")
            return
        }

        logger.info("Found {} songs to translate, processing in parallel", batch.size)

        var succeeded = 0
        var failed = 0

        val futures = batch.map { lyricEntity ->
            CompletableFuture.supplyAsync {
                logger.info(
                    "[songId={}] Starting translation (status={}, retryCount={})",
                    lyricEntity.songId, lyricEntity.status, lyricEntity.retryCount
                )

                // Transition to PROCESSING
                logger.info("[songId={}] Status: {} → PROCESSING", lyricEntity.songId, lyricEntity.status)
                lyricEntity.status = KoreanLyricStatus.PROCESSING
                lyricEntity.updatedAt = Instant.now()
                lyricRepository.save(lyricEntity)

                try {
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

        CompletableFuture.allOf(*futures.toTypedArray()).join()

        futures.forEach { future ->
            if (future.get()) succeeded++ else failed++
        }

        logger.info("Batch complete: {} succeeded, {} failed out of {} total", succeeded, failed, batch.size)
    }
}
