package com.japanese.vocabulary.admin.push

import com.japanese.vocabulary.song.event.SongReportApprovedEvent
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Component
class SongReportApprovedNotificationListener(private val dispatcher: SongReportApprovedNotificationDispatcher) {
    private val logger = LoggerFactory.getLogger(javaClass)

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onApproved(event: SongReportApprovedEvent) {
        try {
            dispatcher.dispatch(event)
        } catch (e: Exception) {
            // 승인은 이미 커밋됐다. 알림 실패가 관리자 응답을 깨면 안 된다.
            logger.warn("Song report approved notification failed reportId={}", event.reportId, e)
        }
    }
}
