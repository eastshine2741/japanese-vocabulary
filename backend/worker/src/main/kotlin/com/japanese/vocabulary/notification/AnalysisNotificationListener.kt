package com.japanese.vocabulary.notification

import com.japanese.vocabulary.songanalysis.event.SongAnalysisCompletedEvent
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Component
class AnalysisNotificationListener(private val dispatcher: AnalysisNotificationDispatcher) {
    private val logger = LoggerFactory.getLogger(javaClass)

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onCompleted(event: SongAnalysisCompletedEvent) {
        try {
            dispatcher.dispatch(event)
        } catch (e: Exception) {
            // Do not propagate even a new-transaction commit failure to the analysis processor.
            logger.warn("Analysis notification dispatch failed workId={}", event.workId, e)
        }
    }
}
