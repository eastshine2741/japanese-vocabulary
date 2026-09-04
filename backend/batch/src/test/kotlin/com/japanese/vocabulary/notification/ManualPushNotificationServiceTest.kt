package com.japanese.vocabulary.notification

import com.japanese.vocabulary.notification.dto.ManualPushRequest
import com.japanese.vocabulary.notification.entity.DeviceTokenEntity
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ManualPushNotificationServiceTest {

    private val deviceTokenRepository: DeviceTokenRepository = mockk()
    private val pushNotificationService: PushNotificationService = mockk()
    private val service = ManualPushNotificationService(deviceTokenRepository, pushNotificationService)

    @Test
    fun `send passes caller data through unchanged`() {
        val dataSlot = slot<Map<String, String>>()
        every { deviceTokenRepository.findAllByUserId(7L) } returns listOf(
            DeviceTokenEntity(userId = 7L, token = "token-7", platform = "ANDROID")
        )
        every {
            pushNotificationService.send(
                userId = 7L,
                token = "token-7",
                title = "공지",
                body = "본문",
                data = capture(dataSlot),
            )
        } returns true

        val result = service.send(
            ManualPushRequest(
                userId = 7L,
                title = " 공지 ",
                body = " 본문 ",
                data = mapOf("type" to "review_reminder", "flashcardId" to "42"),
            )
        )

        assertThat(result.sent).isEqualTo(1)
        assertThat(dataSlot.captured).containsExactlyInAnyOrderEntriesOf(
            mapOf("type" to "review_reminder", "flashcardId" to "42")
        )
        verify(exactly = 1) { pushNotificationService.send(any(), any(), any(), any(), any()) }
    }
}
