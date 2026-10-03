package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisStageRef
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisStageTarget
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisStageStatus
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkStageRepository
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import com.japanese.vocabulary.test.WorkerBaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import io.micrometer.core.instrument.MeterRegistry
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.time.Duration
import java.time.Instant

/**
 * 단계 원장의 상호배제와 펜스. 큐는 at-least-once 이고 worker 는 죽을 수 있으므로, 같은 단계가
 * 두 번 돌거나 넘겨받힌 worker 가 뒤늦게 결과를 쓰는 일을 원장이 막아야 한다.
 */
class SongAnalysisWorkStageLedgerTest : WorkerBaseIntegrationTest() {

    @Autowired private lateinit var workService: SongAnalysisWorkService
    @Autowired private lateinit var completionService: SongAnalysisWorkCompletionService
    @Autowired private lateinit var workRepository: SongAnalysisWorkRepository
    @Autowired private lateinit var stageRepository: SongAnalysisWorkStageRepository
    @Autowired private lateinit var songRepository: SongRepository
    @Autowired private lateinit var lyricRepository: LyricRepository
    @Autowired private lateinit var meterRegistry: MeterRegistry

    @Test
    fun `claiming the first stage starts the work and the stage`() {
        val work = seedWork("猫")

        val claimed = workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = false)

        assertThat(claimed).isNotNull
        assertThat(claimed!!.ref.attempt).isEqualTo(1)
        val refreshed = workRepository.findById(work.id!!).orElseThrow()
        assertThat(refreshed.status).isEqualTo(SongAnalysisWorkStatus.RUNNING)
        assertThat(refreshed.currentStage).isEqualTo(SongAnalysisWorkStage.FIRST)
        assertThat(refreshed.startedAt).isNotNull
        assertThat(stage(work, SongAnalysisWorkStage.FIRST).status).isEqualTo(SongAnalysisStageStatus.RUNNING)
    }

    @Test
    fun `the works gauge counts pending and running works from the ledger`() {
        val pendingBefore = worksGauge(SongAnalysisWorkStatus.PENDING)
        val runningBefore = worksGauge(SongAnalysisWorkStatus.RUNNING)
        seedWork("待機")
        val running = seedWork("実行")

        workService.claimStage(running.id!!, SongAnalysisWorkStage.FIRST, redelivered = false)

        assertThat(worksGauge(SongAnalysisWorkStatus.PENDING)).isEqualTo(pendingBefore + 1)
        assertThat(worksGauge(SongAnalysisWorkStatus.RUNNING)).isEqualTo(runningBefore + 1)
    }

    /** 큐는 at-least-once 라 같은 메시지가 두 번 올 수 있다. 두 번째 배달은 잡히면 안 된다. */
    @Test
    fun `a duplicate delivery of a running stage is not claimed`() {
        val work = seedWork("重複")

        val first = workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = false)
        val second = workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = false)

        assertThat(first).isNotNull
        assertThat(second).isNull()
    }

    /**
     * 브로커는 처리 중이던 consumer 의 연결이 끊겼을 때만 다시 배달한다. 그 메시지는 RUNNING 단계를
     * 넘겨받고, 원래 worker 가 뒤늦게 쓰는 결과는 attempt 가 달라 버려진다.
     */
    @Test
    fun `a redelivered message takes over a running stage and fences the previous attempt`() {
        val work = seedWork("引継ぎ")
        val original = workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = false)!!

        val takeover = workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = true)

        assertThat(takeover).isNotNull
        assertThat(takeover!!.ref.attempt).isEqualTo(2)
        assertThat(workService.completeStage(original.ref, "{}")).isFalse
        assertThat(workService.completeStage(takeover.ref, "{}")).isTrue
        assertThat(workRepository.findById(work.id!!).orElseThrow().currentStage).isEqualTo(SongAnalysisWorkStage.FIRST.next)
    }

    @Test
    fun `completing a stage moves the work to the next one and keeps the output`() {
        val work = seedWork("次へ")
        val claimed = workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = false)!!

        workService.completeStage(claimed.ref, """{"lines":1}""")

        assertThat(workRepository.findById(work.id!!).orElseThrow().currentStage).isEqualTo(SongAnalysisWorkStage.FETCH_YOUTUBE)
        assertThat(workService.completedOutputs(work.id!!)).containsEntry(SongAnalysisWorkStage.FIRST, """{"lines":1}""")
    }

    @Test
    fun `a stage message the work is not waiting for is not claimed`() {
        val work = seedWork("順番")

        val claimed = workService.claimStage(work.id!!, SongAnalysisWorkStage.SELECT_SENSES, redelivered = false)

        assertThat(claimed).isNull()
        assertThat(workRepository.findById(work.id!!).orElseThrow().status).isEqualTo(SongAnalysisWorkStatus.PENDING)
    }

    @Test
    fun `terminal work is not claimed`() {
        val work = seedWork("失敗", status = SongAnalysisWorkStatus.FAILED)

        assertThat(workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = true)).isNull()
    }

    /** 진행이 멈춘 RUNNING 행은 FAILED 로 넘어가고, 그 뒤에 돌아온 worker 는 아무것도 쓰지 못한다. */
    @Test
    fun `stale running work is failed and its worker can no longer write`() {
        val work = seedWork("停止")
        val claimed = workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = false)!!

        val failedCount = workService.failStaleRunning(olderThan = staleThreshold(), limit = 5)

        assertThat(failedCount).isEqualTo(1)
        val refreshed = workRepository.findById(work.id!!).orElseThrow()
        assertThat(refreshed.status).isEqualTo(SongAnalysisWorkStatus.FAILED)
        assertThat(refreshed.errorCode).isEqualTo("SONG_ANALYSIS_WORK_TIMEOUT")
        assertThat(stage(work, SongAnalysisWorkStage.FIRST).status).isEqualTo(SongAnalysisStageStatus.FAILED)
        assertThat(workService.completeStage(claimed.ref, "{}")).isFalse
        assertThat(workService.recordProgress(claimed.ref, "{}")).isFalse
    }

    @Test
    fun `fresh running work is left alone by the sweep`() {
        val work = seedWork("進行中")
        workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = false)

        val failedCount = workService.failStaleRunning(
            olderThan = Instant.now(clock).minus(Duration.ofMinutes(10)),
            limit = 5,
        )

        assertThat(failedCount).isZero
    }

    @Test
    fun `a stale worker cannot save analyzed content after the work timed out`() {
        val lyric = seedLyric()
        val work = seedWork("副作用禁止")
        val claimed = runToStage(work, SongAnalysisWorkStage.COMPLETE)
        work.lyricId = lyric.id
        workRepository.saveAndFlush(work)

        workService.failStaleRunning(olderThan = staleThreshold(), limit = 5)

        assertThatThrownBy {
            completionService.completeWithAnalyzedContent(
                ref = claimed,
                lyricId = lyric.id!!,
                analyzedLines = listOf(AnalyzedLine(index = 0, koreanLyrics = "고양이", tokens = emptyList())),
                output = null,
            )
        }.isInstanceOf(SongAnalysisStageSupersededException::class.java)
        assertThat(lyricRepository.findById(lyric.id!!).orElseThrow().analyzedContent).isNull()
    }

    /** 다음 단계 발행을 잃은 RUNNING 작업은 sweeper 가 기다리는 단계를 다시 발행한다. */
    @Test
    fun `running work whose next stage never started is reported as a lost message`() {
        val work = seedWork("迷子")
        val claimed = workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = false)!!
        workService.completeStage(claimed.ref, "{}")

        val lost = workService.findLostMessages(olderThan = staleThreshold(), limit = 10)

        assertThat(lost).contains(SongAnalysisStageTarget(work.id!!, SongAnalysisWorkStage.FETCH_YOUTUBE))
    }

    @Test
    fun `running work whose stage is still running is not a lost message`() {
        val work = seedWork("処理中")
        workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = false)

        val lost = workService.findLostMessages(olderThan = staleThreshold(), limit = 10)

        assertThat(lost.map { it.workId }).doesNotContain(work.id)
    }

    @Test
    fun `resume reopens the failed stage and asks for it again`() {
        val work = seedWork("再開")
        val claimed = runToStage(work, SongAnalysisWorkStage.ANALYZE_LYRICS)
        workService.failStage(claimed, SongAnalysisWorkListener.classify(IllegalStateException("boom")))

        val resumed = workService.resume(work.id!!)

        assertThat(resumed.status).isEqualTo(SongAnalysisWorkStatus.PENDING)
        assertThat(stage(work, SongAnalysisWorkStage.ANALYZE_LYRICS).status).isEqualTo(SongAnalysisStageStatus.PENDING)
        val again = workService.claimStage(work.id!!, SongAnalysisWorkStage.ANALYZE_LYRICS, redelivered = false)
        assertThat(again!!.ref.attempt).isEqualTo(2)
        assertThat(workRepository.findById(work.id!!).orElseThrow().status).isEqualTo(SongAnalysisWorkStatus.RUNNING)
    }

    @Test
    fun `resume is refused while another work for the same song is active`() {
        val work = seedWork("競合")
        val claimed = runToStage(work, SongAnalysisWorkStage.FETCH_LYRICS)
        workService.failStage(claimed, SongAnalysisWorkListener.classify(IllegalStateException("boom")))
        seedWork("競合")

        assertThatThrownBy { workService.resume(work.id!!) }
            .hasMessageContaining("already exists")
    }

    /**
     * 배포 직전 구 파이프라인이 잡은 작업. 그 파드가 아직 돌고 있을 수 있고 앞 단계 산출물도 없으므로,
     * 다시 배달된 메시지도 sweeper 도 넘겨받지 않는다.
     */
    @Test
    fun `work a pre-ledger pod is running is neither taken over nor republished`() {
        val legacy = seedWork("旧実行中", status = SongAnalysisWorkStatus.RUNNING).apply {
            currentStage = SongAnalysisWorkStage.ANALYZE_LYRICS
        }
        workRepository.saveAndFlush(legacy)

        val claimed = workService.claimStage(legacy.id!!, SongAnalysisWorkStage.ANALYZE_LYRICS, redelivered = true)
        val lost = workService.findLostMessages(olderThan = staleThreshold(), limit = 10)

        assertThat(claimed).isNull()
        assertThat(lost.map { it.workId }).doesNotContain(legacy.id)
    }

    /** 앞 단계를 끝낸 뒤 다음 단계 메시지를 끝내 못 받고 시간 초과된 작업도 그 단계부터 이어 간다. */
    @Test
    fun `work that timed out waiting for its next stage can be resumed at that stage`() {
        val work = seedWork("待機切れ")
        val claimed = workService.claimStage(work.id!!, SongAnalysisWorkStage.FIRST, redelivered = false)!!
        workService.completeStage(claimed.ref, "{}")
        workService.failStaleRunning(olderThan = staleThreshold(), limit = 5)

        workService.resume(work.id!!)

        val again = workService.claimStage(work.id!!, SongAnalysisWorkStage.FETCH_YOUTUBE, redelivered = false)
        assertThat(again).isNotNull
        assertThat(again!!.ref.attempt).isEqualTo(1)
    }

    @Test
    fun `work that failed before the stage ledger existed cannot be resumed`() {
        val work = seedWork("旧", status = SongAnalysisWorkStatus.FAILED).apply {
            currentStage = SongAnalysisWorkStage.ANALYZE_LYRICS
        }
        workRepository.saveAndFlush(work)

        assertThatThrownBy { workService.resume(work.id!!) }
            .hasMessageContaining("cannot be resumed")
    }

    /** [target] 직전 단계까지 빈 산출물로 끝내고 [target] 을 잡는다. */
    private fun runToStage(work: SongAnalysisWorkEntity, target: SongAnalysisWorkStage): SongAnalysisStageRef {
        var stage = SongAnalysisWorkStage.FIRST
        while (true) {
            val claimed = workService.claimStage(work.id!!, stage, redelivered = false)!!
            if (stage == target) return claimed.ref
            workService.completeStage(claimed.ref, "{}")
            stage = stage.next!!
        }
    }

    private fun stage(work: SongAnalysisWorkEntity, stage: SongAnalysisWorkStage) =
        stageRepository.findByWorkIdAndStage(work.id!!, stage)!!

    private fun seedWork(title: String, status: SongAnalysisWorkStatus = SongAnalysisWorkStatus.PENDING): SongAnalysisWorkEntity =
        workRepository.saveAndFlush(
            SongAnalysisWorkEntity(
                rawTitle = title,
                rawArtist = "アーティスト",
                status = status,
                triggerSource = SongAnalysisTriggerSource.USER_APP,
            ),
        )

    private fun seedLyric(): LyricEntity {
        val song = songRepository.save(SongEntity(title = "テスト${System.nanoTime()}", artist = "アーティスト", durationSeconds = 200))
        return lyricRepository.save(
            LyricEntity(
                songId = song.id!!,
                lyricType = LyricType.PLAIN,
                rawContent = listOf(LyricLineData(index = 0, startTimeMs = null, text = "猫")),
            ),
        )
    }

    /**
     * `updated_at` 은 JPA auditing 이 [clock] 으로 쓰고 DB 의 ON UPDATE 도 걸려 있어 과거로 미룰 수
     * 없다. 그래서 행을 낡게 만드는 대신 기준선을 테스트 시각보다 앞으로 올려 전부 멈춘 것으로 본다.
     * 테스트 clock 은 고정값이므로 기준선도 반드시 거기서 뽑아야 한다.
     */
    private fun staleThreshold(): Instant = Instant.now(clock).plus(Duration.ofMinutes(1))

    private fun worksGauge(status: SongAnalysisWorkStatus): Double =
        meterRegistry.get(MetricNames.SONG_ANALYSIS_WORKS).tag("status", status.name).gauge().value()
}
