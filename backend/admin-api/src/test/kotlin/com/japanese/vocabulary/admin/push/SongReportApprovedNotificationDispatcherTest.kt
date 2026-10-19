package com.japanese.vocabulary.admin.push

import com.japanese.vocabulary.notification.entity.DeviceTokenEntity
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.event.SongReportApprovedEvent
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.repository.UserRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.ObjectProvider
import java.util.Optional

class SongReportApprovedNotificationDispatcherTest {

    private val userRepository: UserRepository = mockk()
    private val tokenRepository: DeviceTokenRepository = mockk()
    private val songRepository: SongRepository = mockk()
    private val push: PushNotificationService = mockk()
    private val pushProvider: ObjectProvider<PushNotificationService> = mockk()
    private val dispatcher = SongReportApprovedNotificationDispatcher(
        userRepository, tokenRepository, songRepository, pushProvider,
    )
    private val event = SongReportApprovedEvent(reportId = 3L, userId = 7L, songId = 11L)

    @BeforeEach
    fun setUp() {
        every { pushProvider.ifAvailable } returns push
        every { userRepository.findByIdAndDeletedAtIsNull(7L) } returns mockk<UserEntity>()
        every { songRepository.findById(11L) } returns Optional.of(mockk<SongEntity> { every { title } returns "夜に駆ける" })
        every { tokenRepository.findAllByUserId(7L) } returns listOf(
            DeviceTokenEntity(userId = 7L, token = "a", platform = "ANDROID"),
            DeviceTokenEntity(userId = 7L, token = "b", platform = "IOS"),
        )
        every { push.send(any(), any(), any(), any(), any()) } returns true
    }

    @Test
    fun `sends to every device of the reporter with song deep link`() {
        dispatcher.dispatch(event)

        val data = mapOf("type" to "song_report_approved", "songId" to "11", "reportId" to "3")
        val body = "「夜に駆ける」을 더 정확하게 다듬는 데 기여해주셔서 감사합니다."
        verify(exactly = 1) { push.send(7L, "a", "보내주신 제보를 반영했어요", body, data) }
        verify(exactly = 1) { push.send(7L, "b", "보내주신 제보를 반영했어요", body, data) }
    }

    @Test
    fun `skips deleted users`() {
        every { userRepository.findByIdAndDeletedAtIsNull(7L) } returns null

        dispatcher.dispatch(event)

        verify(exactly = 0) { push.send(any(), any(), any(), any(), any()) }
    }
}
