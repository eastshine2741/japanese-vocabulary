package com.japanese.vocabulary.admin.reels

import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.stereotype.Service
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.attribute.FileTime
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.io.path.getLastModifiedTime
import kotlin.io.path.name

@Service
@EnableConfigurationProperties(AdminReelsSourceProperties::class)
class SubprocessAdminReelsSourceCache(
    private val rendererProperties: AdminReelsRendererProperties,
    private val properties: AdminReelsSourceProperties,
) : AdminReelsSourceCache {
    private val locks = ConcurrentHashMap<String, Any>()

    override fun cached(youtubeUrl: String): Path? {
        val target = targetFor(youtubeUrl)
        if (!Files.isRegularFile(target) || Files.size(target) == 0L) return null
        touch(target)
        return target
    }

    override fun fetch(youtubeUrl: String): Path {
        val target = targetFor(youtubeUrl)
        synchronized(locks.computeIfAbsent(target.name) { Any() }) {
            cached(youtubeUrl)?.let { return it }
            Files.createDirectories(properties.directory)
            val downloadDir = Files.createTempDirectory(properties.directory, "download-")
            try {
                val downloaded = downloadDir.resolve("source.mp4")
                download(youtubeUrl, downloaded)
                Files.move(downloaded, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
            } finally {
                deleteRecursively(downloadDir)
            }
            evictOldest(keep = target)
            logger.info("Cached admin reel source bytes={} path={}", Files.size(target), target)
            return target
        }
    }

    private fun download(youtubeUrl: String, output: Path) {
        val command = properties.command + listOf("--url", youtubeUrl, "--output", output.toString())
        val process = try {
            ProcessBuilder(command)
                .directory(rendererProperties.workingDirectory.toFile())
                .redirectErrorStream(true)
                .start()
        } catch (exception: Exception) {
            logger.warn("Admin reel source fetcher could not start command={} message={}", command, exception.message, exception)
            throw AdminReelsExtractionException("Could not start source download")
        }
        val log = StringBuilder()
        val reader = Thread {
            process.inputStream.bufferedReader(StandardCharsets.UTF_8).useLines { lines ->
                lines.forEach { line ->
                    synchronized(log) {
                        log.appendLine(line)
                        if (log.length > rendererProperties.maxLogBytes) log.delete(0, log.length - rendererProperties.maxLogBytes)
                    }
                }
            }
        }.also {
            it.isDaemon = true
            it.start()
        }
        val finished = process.waitFor(properties.timeout.seconds, TimeUnit.SECONDS)
        if (!finished) {
            process.toHandle().descendants().forEach { runCatching { it.destroyForcibly() } }
            process.destroyForcibly()
            throw AdminReelsExtractionException("Source download timed out")
        }
        reader.join(Duration.ofSeconds(2).toMillis())
        if (process.exitValue() != 0 || !Files.isRegularFile(output) || Files.size(output) == 0L) {
            logger.warn("Admin reel source download failed exit={} output={}", process.exitValue(), synchronized(log) { log.toString() })
            throw AdminReelsExtractionException("Could not extract source media for this YouTube URL")
        }
    }

    /** 최근에 쓴 순서로 [AdminReelsSourceProperties.maxFiles] 개만 남긴다. 스트리밍 중인 파일은 지워도 열린 핸들은 살아 있다. */
    private fun evictOldest(keep: Path) {
        val files = Files.list(properties.directory).use { stream ->
            stream.filter { Files.isRegularFile(it) && it.name.endsWith(".mp4") }.toList()
        }
        files.filter { it != keep }
            .sortedBy { it.getLastModifiedTime() }
            .take((files.size - properties.maxFiles).coerceAtLeast(0))
            .forEach { path ->
                logger.info("Evicting admin reel source path={}", path)
                runCatching { Files.deleteIfExists(path) }
            }
    }

    private fun targetFor(youtubeUrl: String): Path {
        val digest = MessageDigest.getInstance("SHA-256").digest(youtubeUrl.toByteArray(StandardCharsets.UTF_8))
        return properties.directory.resolve(digest.joinToString("") { "%02x".format(it) } + ".mp4")
    }

    private fun touch(path: Path) {
        runCatching { Files.setLastModifiedTime(path, FileTime.from(Instant.now())) }
    }

    private fun deleteRecursively(path: Path) {
        runCatching {
            Files.walk(path)
                .sorted(Comparator.reverseOrder())
                .forEach(Files::deleteIfExists)
        }
    }

    companion object {
        private val logger = LoggerFactory.getLogger(SubprocessAdminReelsSourceCache::class.java)
    }
}

@ConfigurationProperties(prefix = "admin.reels.source")
data class AdminReelsSourceProperties(
    val directory: Path = Path.of(System.getProperty("java.io.tmpdir"), "kotonoha-reels-sources"),
    val command: List<String> = listOf("npm", "run", "fetch:source", "--"),
    val timeout: Duration = Duration.ofMinutes(3),
    /** 1080p MV 하나가 100~200MB 라 파드 임시 디스크를 생각해 몇 개만 둔다. */
    val maxFiles: Int = 4,
)
