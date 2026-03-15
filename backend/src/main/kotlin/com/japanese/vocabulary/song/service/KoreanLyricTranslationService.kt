package com.japanese.vocabulary.song.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.song.client.gemini.GeminiClient
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.repository.KoreanLyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Pageable
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import java.util.concurrent.CompletableFuture

@Service
class KoreanLyricTranslationService(
    private val koreanLyricRepository: KoreanLyricRepository,
    private val songRepository: SongRepository,
    private val geminiClient: GeminiClient,
    private val objectMapper: ObjectMapper
) {
    private val logger = LoggerFactory.getLogger("KoreanLyricTranslation")

    companion object {
        private const val MAX_RETRIES = 3
        private const val BATCH_SIZE = 5
    }

    @Scheduled(fixedDelay = 30_000)
    fun processTranslations() {
        logger.info("Polling for next translation batch...")

        val batch = koreanLyricRepository.findNextForTranslation(
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

        val futures = batch.map { koreanLyric ->
            CompletableFuture.supplyAsync {
                val song = songRepository.findById(koreanLyric.songId).orElse(null)
                if (song == null) {
                    logger.error("[songId={}] Song not found, marking as FAILED", koreanLyric.songId)
                    koreanLyric.status = KoreanLyricStatus.FAILED
                    koreanLyricRepository.save(koreanLyric)
                    return@supplyAsync false
                }

                logger.info(
                    "[songId={}] Starting translation for '{}' by '{}' (status={}, retryCount={})",
                    koreanLyric.songId, song.title, song.artist, koreanLyric.status, koreanLyric.retryCount
                )

                // Transition to PROCESSING
                logger.info("[songId={}] Status: {} → PROCESSING", koreanLyric.songId, koreanLyric.status)
                koreanLyric.status = KoreanLyricStatus.PROCESSING
                koreanLyricRepository.save(koreanLyric)

                try {
                    // Parse lyric content
                    val lyricLines: List<Map<String, Any?>> = objectMapper.readValue(
                        song.lyricContent,
                        objectMapper.typeFactory.constructCollectionType(
                            List::class.java,
                            objectMapper.typeFactory.constructMapType(
                                Map::class.java, String::class.java, Any::class.java
                            )
                        )
                    )
                    logger.info("[songId={}] Fetching lyric content ({} lines)", koreanLyric.songId, lyricLines.size)

                    // Call Gemini API
                    logger.info("[songId={}] Calling Gemini API...", koreanLyric.songId)
                    val translated = geminiClient.translateLyrics(lyricLines)
                    logger.info("[songId={}] Gemini API responded ({} translated lines)", koreanLyric.songId, translated.size)

                    if (translated.size != lyricLines.size) {
                        logger.warn(
                            "[songId={}] Line count mismatch: expected={}, got={} — saving partial result",
                            koreanLyric.songId, lyricLines.size, translated.size
                        )
                    }

                    // Save result
                    koreanLyric.content = objectMapper.writeValueAsString(translated)
                    koreanLyric.status = KoreanLyricStatus.COMPLETED
                    koreanLyricRepository.save(koreanLyric)
                    logger.info("[songId={}] Status: PROCESSING → COMPLETED", koreanLyric.songId)
                    true
                } catch (e: Exception) {
                    koreanLyric.retryCount++
                    if (koreanLyric.retryCount >= MAX_RETRIES) {
                        koreanLyric.status = KoreanLyricStatus.FAILED
                        koreanLyricRepository.save(koreanLyric)
                        logger.error(
                            "[songId={}] Translation failed (attempt {}/{}): {}",
                            koreanLyric.songId, koreanLyric.retryCount, MAX_RETRIES, e.message
                        )
                        logger.error("[songId={}] Status: PROCESSING → FAILED (max retries reached)", koreanLyric.songId)
                    } else {
                        koreanLyric.status = KoreanLyricStatus.PENDING
                        koreanLyricRepository.save(koreanLyric)
                        logger.error(
                            "[songId={}] Translation failed (attempt {}/{}): {}",
                            koreanLyric.songId, koreanLyric.retryCount, MAX_RETRIES, e.message
                        )
                        logger.info("[songId={}] Status: PROCESSING → PENDING (will retry)", koreanLyric.songId)
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
