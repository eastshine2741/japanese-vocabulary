package com.japanese.vocabulary.admin.reels

import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderJobResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderJobStatus
import com.japanese.vocabulary.admin.reels.model.AdminReelsRenderInput
import com.japanese.vocabulary.admin.reels.model.AdminReelsRenderSource
import jakarta.annotation.PreDestroy
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * 렌더를 요청과 떼어 파드 안에서 돌린다. 브라우저를 닫아도 렌더는 끝까지 가고, 결과는 [AdminReelsRendererProperties.retention]
 * 동안 다시 받을 수 있다. 작업 목록은 메모리에만 있어 파드가 재시작하면 사라진다.
 */
@Service
class AdminReelsRenderJobService(
    private val renderService: AdminReelsRenderService,
    private val properties: AdminReelsRendererProperties,
) {
    private val jobs = ConcurrentHashMap<String, Job>()
    private val threadNumber = AtomicInteger()
    private val executor = Executors.newFixedThreadPool(properties.concurrency) { runnable ->
        Thread(runnable, "reels-render-${threadNumber.incrementAndGet()}").also { it.isDaemon = true }
    }

    fun submit(songId: Long, input: AdminReelsRenderInput): AdminReelsRenderJobResponse {
        purgeExpired()
        val pinnedDir = Files.createTempDirectory("kotonoha-reels-job-")
        val pinned = try {
            input.copy(source = AdminReelsRenderSource(localPath = pinSource(Path.of(input.source.localPath), pinnedDir).toString()))
        } catch (exception: Exception) {
            deleteRecursively(pinnedDir)
            throw exception
        }
        val job = Job(
            id = UUID.randomUUID().toString(),
            songId = songId,
            title = input.data.song.title,
            artist = input.data.song.artist,
            status = AdminReelsRenderJobStatus.QUEUED,
            createdAt = Instant.now(),
        )
        jobs[job.id] = job
        executor.execute { run(job.id, pinned, pinnedDir) }
        return job.toResponse()
    }

    /**
     * 줄 서 있는 동안 source 캐시가 그 곡을 밀어내거나 새로 올린 MV 로 바꿔치면 엉뚱한 MV 로 렌더된다.
     * 맡긴 순간의 파일을 작업 몫으로 잡아 둔다 — 하드링크라 복사 비용이 없고, 다른 파일시스템이면 복사한다.
     */
    private fun pinSource(source: Path, dir: Path): Path {
        val target = dir.resolve("source.mp4")
        try {
            Files.createLink(target, source)
        } catch (exception: Exception) {
            Files.copy(source, target)
        }
        return target
    }

    fun list(): List<AdminReelsRenderJobResponse> {
        purgeExpired()
        return jobs.values.sortedByDescending { it.createdAt }.map { it.toResponse() }
    }

    fun output(id: String): Path {
        val job = jobs[id] ?: throw NoSuchElementException("Render job not found")
        return job.output?.takeIf { Files.isRegularFile(it) } ?: throw NoSuchElementException("Render output is not ready")
    }

    private fun run(id: String, input: AdminReelsRenderInput, pinnedDir: Path) {
        update(id) { it.copy(status = AdminReelsRenderJobStatus.RUNNING) }
        val result = runCatching { renderService.render(input) }
        deleteRecursively(pinnedDir)
        result.exceptionOrNull()?.let { logger.warn("Admin reel render job failed id={} message={}", id, it.message) }
        update(id) { job ->
            result.fold(
                onSuccess = { output -> job.copy(status = AdminReelsRenderJobStatus.SUCCEEDED, output = output) },
                onFailure = { cause ->
                    val error = if (cause is AdminReelsRenderTimeoutException) "render_timeout" else "render_failed"
                    job.copy(status = AdminReelsRenderJobStatus.FAILED, error = error)
                },
            ).copy(finishedAt = Instant.now())
        }
    }

    private fun update(id: String, change: (Job) -> Job) {
        jobs.computeIfPresent(id) { _, job -> change(job) }
    }

    private fun purgeExpired() {
        val cutoff = Instant.now().minus(properties.retention)
        jobs.values
            .filter { job -> job.finishedAt?.isBefore(cutoff) == true }
            .forEach { job ->
                jobs.remove(job.id)
                job.output?.let { deleteRecursively(it.parent) }
            }
    }

    private fun deleteRecursively(path: Path) {
        runCatching {
            Files.walk(path).use { stream ->
                stream.sorted(Comparator.reverseOrder()).forEach(Files::deleteIfExists)
            }
        }
    }

    @PreDestroy
    fun shutdown() {
        executor.shutdownNow()
    }

    private data class Job(
        val id: String,
        val songId: Long,
        val title: String,
        val artist: String,
        val status: AdminReelsRenderJobStatus,
        val createdAt: Instant,
        val finishedAt: Instant? = null,
        val error: String? = null,
        val output: Path? = null,
    ) {
        fun toResponse() = AdminReelsRenderJobResponse(
            id = id,
            songId = songId,
            title = title,
            artist = artist,
            status = status,
            error = error,
            createdAt = createdAt,
            finishedAt = finishedAt,
        )
    }

    companion object {
        private val logger = LoggerFactory.getLogger(AdminReelsRenderJobService::class.java)
    }
}
