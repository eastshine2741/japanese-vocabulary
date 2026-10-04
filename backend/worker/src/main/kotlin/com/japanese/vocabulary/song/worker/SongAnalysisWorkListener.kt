package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.common.retry.RetryDeadline
import com.japanese.vocabulary.common.retry.TransientHttpErrors
import com.japanese.vocabulary.messagequeue.SongAnalysisQueue
import com.japanese.vocabulary.messagequeue.SongAnalysisWorkMessage
import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.songanalysis.dto.ClaimedSongAnalysisStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisStageFailure
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.amqp.support.AmqpHeaders
import org.springframework.beans.factory.annotation.Value
import org.springframework.messaging.handler.annotation.Header
import org.springframework.stereotype.Component
import java.net.InetAddress
import java.time.Duration
import java.time.Instant
import kotlin.coroutines.CoroutineContext

/**
 * 곡 분석의 단계 하나를 처리한다. 메시지는 workId 와 단계만 싣고, 처리 여부는 원장이 정한다.
 *
 * - 같은 메시지가 두 번 와도 [SongAnalysisWorkService.claimStage] 가 한 번만 잡는다. 처리 중이던
 *   worker 가 죽어서 브로커가 다시 배달한 메시지만 RUNNING 단계를 넘겨받는다.
 * - 단계 실패는 원장에 FAILED 로 적고 메시지는 ack 한다. 오류로 메시지를 다시 넣는 재시도는 없다 —
 *   유저가 기다리는 시간([timeBudget]) 안에 끝날 수 없는 재시도는 의미가 없고, 그 안에 끝나는
 *   일시 장애는 HTTP 호출 단위의 재시도가 흡수한다. 그 재시도도 [RetryDeadline] 을 넘겨 기다리지 않는다.
 * - 예외를 던지는 경우는 실패 기록조차 못 하는 인프라 장애(DB 접근 불가)뿐이고, 그때만 DLQ 로 간다.
 * - 리스너 스레드는 단계가 끝날 때까지 블로킹해야 ack 가 처리 완료 뒤에 나간다. 그 안의 코루틴은
 *   IO 디스패처에서 돌아야 파이프라인의 병렬 구간이 실제로 병렬이 된다.
 */
@Component
class SongAnalysisWorkListener(
    private val workService: SongAnalysisWorkService,
    private val executor: SongAnalysisStageExecutor,
    private val meterRegistry: MeterRegistry,
    @Value("\${song-analysis.worker.time-budget:5m}") private val timeBudget: Duration,
) {
    private val logger = LoggerFactory.getLogger(SongAnalysisWorkListener::class.java)
    private val workerId = "${InetAddress.getLocalHost().hostName}-${ProcessHandle.current().pid()}"

    @RabbitListener(
        queues = [SongAnalysisQueue.QUEUE],
        concurrency = "\${song-analysis.worker.concurrency:3}",
    )
    fun onMessage(
        message: SongAnalysisWorkMessage,
        @Header(AmqpHeaders.REDELIVERED) redelivered: Boolean,
    ) = handle(message, redelivered, Dispatchers.IO)

    /**
     * [dispatcher] 는 테스트가 바꾸려고 연 것이다. 통합 테스트는 테스트 트랜잭션 안에서 돌므로
     * 코루틴이 같은 스레드에 있어야 그 트랜잭션의 데이터를 본다.
     */
    internal fun handle(message: SongAnalysisWorkMessage, redelivered: Boolean, dispatcher: CoroutineContext) {
        val stage = message.stage ?: SongAnalysisWorkStage.FIRST
        val claimed = workService.claimStage(message.workId, stage, redelivered)
        if (claimed == null) {
            logger.info("[workId={}] {} is not claimable, skipping (redelivered={})", message.workId, stage, redelivered)
            return
        }
        // 원장에 처리자를 적지 않으므로, 어느 파드가 잡았는지는 이 로그가 유일한 단서다.
        logger.info(
            "[workId={}] {} attempt {} claimed by {}{}",
            message.workId, stage, claimed.ref.attempt, workerId, if (redelivered) " (taken over)" else "",
        )
        run(claimed, dispatcher)
    }

    private fun run(claimed: ClaimedSongAnalysisStage, dispatcher: CoroutineContext) {
        val sample = Timer.start(meterRegistry)
        val deadline = claimed.startedAt.plus(timeBudget)
        val outcome = try {
            runBlocking(dispatcher + RetryDeadline(deadline)) { executor.execute(claimed) }
            if (claimed.ref.stage.next == null) recordWorkDuration(claimed, "success")
            "success"
        } catch (e: SongAnalysisStageSupersededException) {
            logger.warn("[workId={}] {}", claimed.ref.workId, e.message)
            "superseded"
        } catch (e: Exception) {
            val failure = classify(e)
            logger.error(
                "[workId={}] {} attempt {} failed with {}",
                claimed.ref.workId, claimed.ref.stage, claimed.ref.attempt, failure.code, e,
            )
            if (workService.failStage(claimed.ref, failure)) recordWorkDuration(claimed, "failed")
            "failed"
        }
        sample.stop(
            Timer.builder(MetricNames.SONG_ANALYSIS_STAGE_DURATION)
                .tag("stage", claimed.ref.stage.name)
                .tag("outcome", outcome)
                .publishPercentileHistogram()
                .maximumExpectedValue(HISTOGRAM_MAX)
                .register(meterRegistry),
        )
    }

    /** 요청부터가 아니라 이번 실행이 시작된 뒤부터다. 관리자가 이어 돌린 작업도 그 실행만 잰다. */
    private fun recordWorkDuration(claimed: ClaimedSongAnalysisStage, outcome: String) {
        Timer.builder(MetricNames.SONG_ANALYSIS_WORK_DURATION)
            .tag("outcome", outcome)
            .publishPercentileHistogram()
            .maximumExpectedValue(HISTOGRAM_MAX)
            .register(meterRegistry)
            .record(Duration.between(claimed.startedAt, Instant.now()))
    }

    companion object {
        /**
         * 타이머 히스토그램의 기본 상한은 30초라 그보다 긴 값은 모두 +Inf 버킷에 떨어지고 백분위가 30초로
         * 눌린다. 작업은 분 단위이고 시간 초과 판정이 10분이므로 그만큼 버킷을 연다.
         */
        private val HISTOGRAM_MAX: Duration = Duration.ofMinutes(10)

        /**
         * 유저에게 보이는 코드는 셋으로만 나눈다: 도메인이 판정한 결과(가사 없음 등), 외부 서비스
         * 장애가 재시도 뒤에도 남은 경우, 그 밖의 모든 것. 원인을 찾는 데 필요한 예외 클래스와 메시지
         * 사슬은 운영자용으로 단계 행에만 남는다.
         */
        fun classify(e: Throwable): SongAnalysisStageFailure {
            val code = when {
                e is BusinessException -> e.errorCode
                generateSequence(e) { it.cause }.any(TransientHttpErrors::isTransient) ->
                    ErrorCode.SONG_ANALYSIS_PROVIDER_UNAVAILABLE
                else -> ErrorCode.SONG_ANALYSIS_WORK_FAILED
            }
            return SongAnalysisStageFailure(
                code = code.name,
                userMessage = code.message,
                errorClass = e::class.qualifiedName,
                detail = generateSequence(e) { it.cause }
                    .take(5)
                    .joinToString(" <- ") { "${it::class.simpleName}: ${it.message}" },
            )
        }
    }
}
