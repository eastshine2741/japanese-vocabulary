package com.japanese.vocabulary.messagequeue

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.event.SongAnalysisWorkQueuedEvent
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

/**
 * 원장 행이 커밋된 뒤에만 발행한다. 커밋과 발행 사이에 프로세스가 죽으면 메시지는 없고 행만 남는데,
 * 그 경우는 worker 의 sweeper 가 멈춘 행을 주워 [publish] 로 다시 넣는다.
 */
@Component
class SongAnalysisWorkQueuePublisher(private val rabbitTemplate: RabbitTemplate) {
    private val logger = LoggerFactory.getLogger(javaClass)

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onQueued(event: SongAnalysisWorkQueuedEvent) {
        publish(event.workId, event.stage)
    }

    fun publish(workId: Long, stage: SongAnalysisWorkStage) {
        try {
            rabbitTemplate.convertAndSend(
                SongAnalysisQueue.EXCHANGE,
                SongAnalysisQueue.ROUTING_KEY,
                SongAnalysisWorkMessage(workId, stage),
            )
            logger.info("Published song analysis work workId={} stage={}", workId, stage)
        } catch (e: Exception) {
            // 원장 행은 이미 커밋됐다. 발행 실패는 sweeper 가 복구하므로 호출자에게 던지지 않는다.
            logger.error("Failed to publish song analysis work workId={} stage={}", workId, stage, e)
        }
    }
}
