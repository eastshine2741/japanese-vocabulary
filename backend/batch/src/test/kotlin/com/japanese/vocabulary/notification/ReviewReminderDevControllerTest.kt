package com.japanese.vocabulary.notification

import com.fasterxml.jackson.databind.ObjectMapper
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.Message
import com.japanese.vocabulary.notification.dto.ManualPushRequest
import com.japanese.vocabulary.notification.entity.DeviceTokenEntity
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import com.ninjasquad.springmockk.MockkBean
import io.mockk.every
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import java.util.concurrent.atomic.AtomicLong

@AutoConfigureMockMvc
@TestPropertySource(
    properties = [
        "push.firebase.enabled=true",
        "push.manual.secret=test-manual-push-secret",
    ]
)
class ReviewReminderDevControllerTest : BatchBaseIntegrationTest() {

    @MockkBean
    private lateinit var firebaseApp: FirebaseApp

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper

    private fun newUser(): UserEntity {
        val seq = USER_SEQUENCE.incrementAndGet()
        return UserEntity(
            provider = "google",
            providerSub = "manual-push-sub-$seq",
            username = "manualpush$seq",
        ).also {
            entityManager.persist(it)
            entityManager.flush()
        }
    }

    private fun addToken(userId: Long, token: String) {
        entityManager.persist(
            DeviceTokenEntity(
                userId = userId,
                token = token,
                platform = "ANDROID",
            )
        )
        entityManager.flush()
    }

    @Test
    fun `POST send pushes arbitrary message to all tokens for the target user`() {
        val user = newUser()
        addToken(user.id!!, "target-token-1")
        addToken(user.id!!, "target-token-2")
        every { firebaseMessaging.send(any<Message>()) } returns "fcm-message-id"

        val body = mockMvc.post("/dev/push/send") {
            header("X-Manual-Push-Secret", "test-manual-push-secret")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                ManualPushRequest(
                    userId = user.id!!,
                    title = "공지",
                    body = "오늘 복습해보세요",
                    data = mapOf("screen" to "review"),
                )
            )
        }.andExpect { status { isOk() } }
            .andReturn()
            .response
            .contentAsString

        assertThat(body).contains(
            "\"userId\":${user.id}",
            "\"targetTokens\":2",
            "\"sent\":2",
            "\"failed\":0",
        )
        verify(exactly = 2) { firebaseMessaging.send(any<Message>()) }
    }

    @Test
    fun `POST send returns zero target tokens when the user has no device token`() {
        val user = newUser()

        val body = mockMvc.post("/dev/push/send") {
            header("X-Manual-Push-Secret", "test-manual-push-secret")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                ManualPushRequest(userId = user.id!!, title = "공지", body = "메시지")
            )
        }.andExpect { status { isOk() } }
            .andReturn()
            .response
            .contentAsString

        assertThat(body).contains(
            "\"userId\":${user.id}",
            "\"targetTokens\":0",
            "\"sent\":0",
            "\"failed\":0",
        )
        verify(exactly = 0) { firebaseMessaging.send(any<Message>()) }
    }

    @Test
    fun `POST send rejects blank title`() {
        val user = newUser()

        mockMvc.post("/dev/push/send") {
            header("X-Manual-Push-Secret", "test-manual-push-secret")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                ManualPushRequest(userId = user.id!!, title = " ", body = "메시지")
            )
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `POST send rejects missing manual push secret`() {
        val user = newUser()

        mockMvc.post("/dev/push/send") {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                ManualPushRequest(userId = user.id!!, title = "공지", body = "메시지")
            )
        }.andExpect { status { isForbidden() } }
    }

    @Test
    fun `POST send rejects invalid manual push secret`() {
        val user = newUser()

        mockMvc.post("/dev/push/send") {
            header("X-Manual-Push-Secret", "wrong-secret")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                ManualPushRequest(userId = user.id!!, title = "공지", body = "메시지")
            )
        }.andExpect { status { isForbidden() } }
    }

    companion object {
        private val USER_SEQUENCE = AtomicLong(0)
    }
}
