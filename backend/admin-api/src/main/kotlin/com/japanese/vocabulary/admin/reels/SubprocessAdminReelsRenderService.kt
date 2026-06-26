package com.japanese.vocabulary.admin.reels

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.admin.reels.model.AdminReelsRenderInput
import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.stereotype.Service
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.time.Duration
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

@Service
@EnableConfigurationProperties(AdminReelsRendererProperties::class)
class SubprocessAdminReelsRenderService(
    private val objectMapper: ObjectMapper,
    private val properties: AdminReelsRendererProperties,
) : AdminReelsRenderService {
    private val active = AtomicBoolean(false)

    override fun render(input: AdminReelsRenderInput): Path {
        if (!active.compareAndSet(false, true)) {
            throw AdminReelsRenderBusyException()
        }
        val workDir = Files.createTempDirectory("kotonoha-reels-")
        try {
            val inputPath = workDir.resolve("render-input.json")
            val outputPath = workDir.resolve("reel.mp4")
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(inputPath.toFile(), input)

            logger.info(
                "Starting admin reel render songTitle={} selectedLineCount={}",
                input.data.song.title,
                input.data.lyricLines.size,
            )

            val command = properties.command + listOf("--input", inputPath.toString(), "--output", outputPath.toString())
            val process = ProcessBuilder(command)
                .directory(properties.workingDirectory.toFile())
                .redirectErrorStream(true)
                .start()

            val outputBuffer = BoundedOutputBuffer(properties.maxLogBytes)
            val outputThread = Thread {
                process.inputStream.use { inputStream ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val read = inputStream.read(buffer)
                        if (read < 0) break
                        outputBuffer.append(buffer, read)
                    }
                }
            }.also {
                it.isDaemon = true
                it.start()
            }

            val finished = process.waitFor(properties.timeout.seconds, TimeUnit.SECONDS)
            if (!finished) {
                killProcessTree(process)
                throw AdminReelsRenderTimeoutException()
            }
            outputThread.join(Duration.ofSeconds(2).toMillis())
            val capturedOutput = outputBuffer.text()
            if (process.exitValue() != 0) {
                throw classifyFailure(capturedOutput)
            }
            if (!Files.exists(outputPath) || Files.size(outputPath) == 0L) {
                throw AdminReelsRenderFailedException("Renderer completed without producing an MP4")
            }
            logger.info("Finished admin reel render outputBytes={}", Files.size(outputPath))
            return outputPath
        } catch (exception: AdminReelsException) {
            deleteRecursively(workDir)
            throw exception
        } catch (exception: Exception) {
            deleteRecursively(workDir)
            logger.warn(
                "Admin reel renderer could not start or crashed workingDirectory={} command={} message={}",
                properties.workingDirectory,
                properties.command,
                exception.message,
                exception,
            )
            throw AdminReelsRenderFailedException(exception.message ?: "Renderer failed")
        } finally {
            deleteRecursively(properties.workingDirectory.resolve("public/admin-render"))
            active.set(false)
        }
    }

    private fun classifyFailure(output: String): AdminReelsException {
        return if (output.contains("EXTRACTION_FAILED", ignoreCase = true)) {
            logger.warn("Admin reel source extraction failed: {}", output.ifBlank { "(no renderer output)" })
            AdminReelsExtractionException("Could not extract source media for this YouTube URL")
        } else {
            logger.warn("Admin reel renderer failed: {}", output.ifBlank { "(no renderer output)" })
            AdminReelsRenderFailedException("Renderer failed")
        }
    }

    private fun killProcessTree(process: Process) {
        val descendants = process.toHandle().descendants().toList().asReversed()
        descendants.forEach { handle -> runCatching { handle.destroyForcibly() } }
        runCatching { process.destroyForcibly() }
        descendants.forEach { handle -> runCatching { handle.onExit().get(2, TimeUnit.SECONDS) } }
        runCatching { process.waitFor(2, TimeUnit.SECONDS) }
    }

    private fun deleteRecursively(path: Path) {
        runCatching {
            Files.walk(path)
                .sorted(Comparator.reverseOrder())
                .forEach(Files::deleteIfExists)
        }
    }

    private class BoundedOutputBuffer(
        private val maxBytes: Int,
    ) {
        private val bytes = ArrayDeque<Byte>()

        @Synchronized
        fun append(buffer: ByteArray, length: Int) {
            repeat(length) { index ->
                bytes.addLast(buffer[index])
                while (bytes.size > maxBytes) bytes.removeFirst()
            }
        }

        @Synchronized
        fun text(): String = bytes.toByteArray().toString(StandardCharsets.UTF_8)
    }

    companion object {
        private val logger = LoggerFactory.getLogger(SubprocessAdminReelsRenderService::class.java)
    }
}

@ConfigurationProperties(prefix = "admin.reels.renderer")
data class AdminReelsRendererProperties(
    val workingDirectory: Path = defaultReelsWorkingDirectory(),
    val command: List<String> = listOf("npm", "run", "render:request", "--"),
    val timeout: Duration = Duration.ofMinutes(8),
    val maxLogBytes: Int = 8192,
)

private fun defaultReelsWorkingDirectory(): Path {
    val userDir = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize()
    val candidates = listOf(
        userDir.resolve("../reels").normalize(),
        userDir.resolve("../../reels").normalize(),
        userDir.resolve("reels").normalize(),
        Path.of("/opt/reels"),
    )
    return candidates.firstOrNull { Files.isDirectory(it) } ?: userDir.resolve("../reels").normalize()
}
