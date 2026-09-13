package com.japanese.vocabulary.admin.reels

import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.stereotype.Service
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.attribute.FileTime
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import kotlin.io.path.getLastModifiedTime
import kotlin.io.path.name

@Service
@EnableConfigurationProperties(AdminReelsSourceProperties::class)
class FileAdminReelsSourceCache(
    private val properties: AdminReelsSourceProperties,
) : AdminReelsSourceCache {
    private val locks = ConcurrentHashMap<Long, Any>()

    override fun cached(songId: Long): Path? {
        val target = targetFor(songId)
        if (!Files.isRegularFile(target) || Files.size(target) == 0L) return null
        touch(target)
        return target
    }

    override fun store(songId: Long, content: InputStream): Path {
        val target = targetFor(songId)
        synchronized(locks.computeIfAbsent(songId) { Any() }) {
            Files.createDirectories(properties.directory)
            val staging = Files.createTempFile(properties.directory, "upload-", ".part")
            try {
                content.use { Files.copy(it, staging, StandardCopyOption.REPLACE_EXISTING) }
                requireMp4(staging)
                Files.move(staging, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
            } finally {
                Files.deleteIfExists(staging)
            }
            evictOldest(keep = target)
            logger.info("Stored admin reel source songId={} bytes={} path={}", songId, Files.size(target), target)
            return target
        }
    }

    /** ISO BMFF 는 첫 박스가 `ftyp` 다. 확장자만 mp4 인 파일은 여기서 걸러 ffmpeg 까지 가지 않게 한다. */
    private fun requireMp4(path: Path) {
        val header = ByteArray(8)
        val read = Files.newInputStream(path).use { it.readNBytes(header, 0, header.size) }
        if (read < header.size || String(header, 4, 4, Charsets.US_ASCII) != "ftyp") {
            throw IllegalArgumentException("source file must be an mp4")
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

    private fun targetFor(songId: Long): Path = properties.directory.resolve("song-$songId.mp4")

    private fun touch(path: Path) {
        runCatching { Files.setLastModifiedTime(path, FileTime.from(Instant.now())) }
    }

    companion object {
        private val logger = LoggerFactory.getLogger(FileAdminReelsSourceCache::class.java)
    }
}

@ConfigurationProperties(prefix = "admin.reels.source")
data class AdminReelsSourceProperties(
    val directory: Path = Path.of(System.getProperty("java.io.tmpdir"), "kotonoha-reels-sources"),
    /** 1080p MV 하나가 100~200MB 라 파드 임시 디스크를 생각해 몇 개만 둔다. */
    val maxFiles: Int = 4,
)
