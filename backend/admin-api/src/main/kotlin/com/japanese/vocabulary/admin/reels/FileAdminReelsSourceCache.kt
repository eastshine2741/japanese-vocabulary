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
    private val transcoder: AdminReelsPreviewTranscoder,
) : AdminReelsSourceCache {
    private val locks = ConcurrentHashMap<Long, Any>()

    override fun cached(songId: Long): AdminReelsCachedSource? {
        val cached = AdminReelsCachedSource(source = sourceFor(songId), preview = previewFor(songId))
        if (!isFile(cached.source) || !isFile(cached.preview)) return null
        touch(cached.source)
        touch(cached.preview)
        return cached
    }

    override fun store(songId: Long, content: InputStream): AdminReelsCachedSource {
        val target = AdminReelsCachedSource(source = sourceFor(songId), preview = previewFor(songId))
        synchronized(locks.computeIfAbsent(songId) { Any() }) {
            Files.createDirectories(properties.directory)
            val staging = Files.createTempFile(properties.directory, "upload-", ".part")
            val previewStaging = Files.createTempFile(properties.directory, "preview-", ".part")
            try {
                content.use { Files.copy(it, staging, StandardCopyOption.REPLACE_EXISTING) }
                requireMp4(staging)
                transcoder.transcode(staging, previewStaging)
                // 원본이 바뀌면 미리보기도 같이 바뀌어야 한다. 옛 미리보기가 새 원본과 섞이지 않게 먼저 지운다.
                Files.deleteIfExists(target.preview)
                Files.move(staging, target.source, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
                Files.move(previewStaging, target.preview, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
            } finally {
                Files.deleteIfExists(staging)
                Files.deleteIfExists(previewStaging)
            }
            evictOldest(keep = songId)
            logger.info(
                "Stored admin reel source songId={} bytes={} previewBytes={} path={}",
                songId,
                Files.size(target.source),
                Files.size(target.preview),
                target.source,
            )
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

    /**
     * 최근에 쓴 곡 순서로 [AdminReelsSourceProperties.maxFiles] 곡만 남긴다. 원본과 미리보기는 한 곡으로 세고 같이 지운다.
     * 스트리밍 중인 파일은 지워도 열린 핸들은 살아 있다.
     */
    private fun evictOldest(keep: Long) {
        val files = Files.list(properties.directory).use { stream ->
            stream.filter { Files.isRegularFile(it) && it.name.endsWith(".mp4") }.toList()
        }
        val bySong = files.groupBy { songIdOf(it) }.filterKeys { it != null && it != keep }
        bySong.entries
            .sortedBy { (_, paths) -> paths.maxOf { it.getLastModifiedTime() } }
            .take((bySong.size + 1 - properties.maxFiles).coerceAtLeast(0))
            .forEach { (songId, paths) ->
                logger.info("Evicting admin reel source songId={} paths={}", songId, paths)
                paths.forEach { path -> runCatching { Files.deleteIfExists(path) } }
            }
    }

    private fun sourceFor(songId: Long): Path = properties.directory.resolve("song-$songId.mp4")

    private fun previewFor(songId: Long): Path = properties.directory.resolve("song-$songId-preview.mp4")

    private fun songIdOf(path: Path): Long? = SONG_FILE.matchEntire(path.name)?.groupValues?.get(1)?.toLongOrNull()

    private fun isFile(path: Path): Boolean = Files.isRegularFile(path) && Files.size(path) > 0L

    private fun touch(path: Path) {
        runCatching { Files.setLastModifiedTime(path, FileTime.from(Instant.now())) }
    }

    companion object {
        private val logger = LoggerFactory.getLogger(FileAdminReelsSourceCache::class.java)
        private val SONG_FILE = Regex("""song-(\d+)(?:-preview)?\.mp4""")
    }
}

@ConfigurationProperties(prefix = "admin.reels.source")
data class AdminReelsSourceProperties(
    val directory: Path = Path.of(System.getProperty("java.io.tmpdir"), "kotonoha-reels-sources"),
    /** 1080p MV 하나가 100~200MB 에 미리보기까지 붙어 파드 임시 디스크를 생각해 몇 곡만 둔다. */
    val maxFiles: Int = 4,
)
