package com.japanese.vocabulary.admin.push

import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import com.japanese.vocabulary.song.event.SongReportApprovedEvent
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.user.repository.UserRepository
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

@Service
class SongReportApprovedNotificationDispatcher(
    private val userRepository: UserRepository,
    private val tokenRepository: DeviceTokenRepository,
    private val songRepository: SongRepository,
    private val pushProvider: ObjectProvider<PushNotificationService>,
) {
    // AFTER_COMMIT 에서도 승인 트랜잭션 자원이 묶여 있어, 알림 로그·토큰 정리는 새 트랜잭션에서 한다.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun dispatch(event: SongReportApprovedEvent) {
        val push = pushProvider.ifAvailable ?: return
        if (userRepository.findByIdAndDeletedAtIsNull(event.userId) == null) return
        val song = songRepository.findById(event.songId).orElse(null) ?: return
        val data = mapOf(
            "type" to "song_report_approved",
            "songId" to event.songId.toString(),
            "reportId" to event.reportId.toString(),
        )
        for (device in tokenRepository.findAllByUserId(event.userId)) {
            push.send(event.userId, device.token, TITLE, body(song.title), data)
        }
    }

    companion object {
        const val TITLE = "짚어주신 부분을 바로잡았어요"
        fun body(songTitle: String) = "「$songTitle」에서 저희가 놓친 부분을 알려주셔서 감사합니다."
    }
}
