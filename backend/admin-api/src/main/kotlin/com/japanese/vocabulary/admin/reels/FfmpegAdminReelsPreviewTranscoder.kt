package com.japanese.vocabulary.admin.reels

import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.stereotype.Service
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.time.Duration
import java.util.concurrent.TimeUnit

/**
 * ffmpeg 로 closed-GOP H.264 미리보기를 만든다.
 *
 * YouTube 에서 받은 MV 는 대개 open GOP(키프레임 대부분이 non-IDR I-frame)라, 그 키프레임으로 seek 하면
 * 뒤따르는 B-frame 이 키프레임 앞 프레임을 참조해 Chrome 소프트웨어 디코더가 `PIPELINE_ERROR_DECODE` 로 죽는다.
 * 1초마다 IDR 을 박아 어디로 seek 해도 디코딩이 시작되게 하고, 미리보기 전용이라 720p 이하·superfast 로 빨리 끝낸다(720p 4분 기준 로컬 4스레드 10초, 56MB).
 * 오디오는 그대로 복사해 타임스탬프가 원본과 같다.
 */
@Service
@EnableConfigurationProperties(AdminReelsPreviewTranscoderProperties::class)
class FfmpegAdminReelsPreviewTranscoder(
    private val properties: AdminReelsPreviewTranscoderProperties,
) : AdminReelsPreviewTranscoder {
    override fun transcode(source: Path, target: Path) {
        val command = listOf(
            properties.ffmpeg,
            "-y",
            "-v", "error",
            "-i", source.toString(),
            "-map", "0:v:0",
            "-map", "0:a?",
            "-c:v", "libx264",
            "-preset", "superfast",
            "-crf", "25",
            "-pix_fmt", "yuv420p",
            "-vf", "scale=-2:'min(720,ih)'",
            "-g", "30",
            "-keyint_min", "30",
            "-sc_threshold", "0",
            "-c:a", "copy",
            "-movflags", "+faststart",
            "-threads", properties.threads.toString(),
            "-f", "mp4",
            target.toString(),
        )
        // stdout/stderr 는 파일로 보낸다. 파이프를 읽지 않고 waitFor 하면 로그가 차서 ffmpeg 이 멈출 수 있다.
        val log = Files.createTempFile(target.parent, "ffmpeg-", ".log")
        try {
            val process = ProcessBuilder(command)
                .redirectErrorStream(true)
                .redirectOutput(log.toFile())
                .start()
            val finished = process.waitFor(properties.timeout.seconds, TimeUnit.SECONDS)
            if (!finished) {
                process.destroyForcibly()
                process.waitFor(2, TimeUnit.SECONDS)
                Files.deleteIfExists(target)
                throw AdminReelsPreviewTranscodeException("Preview transcode timed out")
            }
            if (process.exitValue() != 0 || !Files.isRegularFile(target) || Files.size(target) == 0L) {
                logger.warn("Preview transcode failed exit={} output={}", process.exitValue(), logTail(log))
                Files.deleteIfExists(target)
                throw AdminReelsPreviewTranscodeException("Preview transcode failed")
            }
        } finally {
            Files.deleteIfExists(log)
        }
    }

    private fun logTail(log: Path): String {
        val bytes = runCatching { Files.readAllBytes(log) }.getOrDefault(ByteArray(0))
        val tail = bytes.copyOfRange((bytes.size - properties.maxLogBytes).coerceAtLeast(0), bytes.size)
        return tail.toString(StandardCharsets.UTF_8).ifBlank { "(no ffmpeg output)" }
    }

    companion object {
        private val logger = LoggerFactory.getLogger(FfmpegAdminReelsPreviewTranscoder::class.java)
    }
}

@ConfigurationProperties(prefix = "admin.reels.preview")
data class AdminReelsPreviewTranscoderProperties(
    val ffmpeg: String = "ffmpeg",
    /** x264 기본 스레드 수는 호스트 코어 기준이라 컨테이너 한도를 넘긴다. 렌더 스크립트와 같은 값. */
    val threads: Int = 4,
    val timeout: Duration = Duration.ofMinutes(5),
    val maxLogBytes: Int = 8192,
)
