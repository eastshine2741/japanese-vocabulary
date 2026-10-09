package com.japanese.vocabulary.karaoke

import com.japanese.vocabulary.karaoke.service.KaraokeSongService
import com.japanese.vocabulary.songanalysis.event.SongAnalysisCompletedEvent
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

/** 분석 도메인은 노래방을 모른다. 완료된 곡을 노래방 원장에 잇는 건 여기서 하고, 놓친 행은 batch 가 매일 다시 잇는다. */
@Component
class KaraokeSongLinkListener(private val karaokeSongService: KaraokeSongService) {
    private val logger = LoggerFactory.getLogger(javaClass)

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun onCompleted(event: SongAnalysisCompletedEvent) {
        try {
            val linked = karaokeSongService.linkCompleted(event.songId)
            if (linked > 0) logger.info("Linked karaoke songs workId={} songId={} rows={}", event.workId, event.songId, linked)
        } catch (e: Exception) {
            logger.warn("Karaoke song link failed workId={} songId={}", event.workId, event.songId, e)
        }
    }
}
