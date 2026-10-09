package com.japanese.vocabulary.user

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.objectstorage.client.PresignedUpload
import com.japanese.vocabulary.objectstorage.client.StoredObject
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.dto.ConfirmProfileImageRequest
import com.japanese.vocabulary.user.dto.ProfileImageUploadUrlRequest
import com.japanese.vocabulary.user.dto.ProfileImageUploadUrlResponse
import com.japanese.vocabulary.user.dto.UserProfileResponse
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.repository.UserRepository
import io.mockk.every
import io.mockk.just
import io.mockk.runs
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import java.time.Instant

@AutoConfigureMockMvc
class ProfileImageControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var userRepository: UserRepository
    @Autowired private lateinit var jwtUtil: JwtUtil

    private fun newUser(block: TestUserBuilder.() -> Unit = {}): UserEntity =
        TestUserBuilder(entityManager).apply(block).build()

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json, T::class.java)

    private fun reloadedKey(user: UserEntity): String? {
        entityManager.flush(); entityManager.clear()
        return userRepository.findById(user.id!!).get().profileImageKey
    }

    @BeforeEach
    fun stubStorage() {
        every { objectStorageClient.enabled } returns true
        every { objectStorageClient.publicUrl(any()) } answers { "https://img.test/${firstArg<String>()}" }
        every { objectStorageClient.delete(any()) } just runs
    }

    @Test
    fun `upload-url issues a key under the user's prefix with the signed headers`() {
        val me = newUser()
        every { objectStorageClient.presignPut(any(), "image/jpeg", any()) } answers {
            PresignedUpload(
                url = "https://r2.test/${firstArg<String>()}?sig",
                headers = mapOf("content-type" to "image/jpeg"),
                expiresAt = Instant.parse("2026-10-05T00:05:00Z"),
            )
        }

        val body = mockMvc.post("/api/users/me/profile-image/upload-url") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(ProfileImageUploadUrlRequest(contentType = "image/jpeg"))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString

        val resp = readBody<ProfileImageUploadUrlResponse>(body)
        assertThat(resp.key).matches("avatars/${me.id}/[0-9a-f-]{36}\\.jpg")
        assertThat(resp.uploadUrl).isEqualTo("https://r2.test/${resp.key}?sig")
        assertThat(resp.headers).containsEntry("content-type", "image/jpeg")
    }

    @Test
    fun `upload-url rejects a non-image content type`() {
        val me = newUser()

        mockMvc.post("/api/users/me/profile-image/upload-url") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(ProfileImageUploadUrlRequest(contentType = "image/gif"))
        }.andExpect { status { isBadRequest() } }
    }

    @Test
    fun `upload-url returns 503 when storage is not configured`() {
        val me = newUser()
        every { objectStorageClient.enabled } returns false

        mockMvc.post("/api/users/me/profile-image/upload-url") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(ProfileImageUploadUrlRequest(contentType = "image/jpeg"))
        }.andExpect { status { isServiceUnavailable() } }
    }

    @Test
    fun `confirm stores the key, deletes the previous object and returns the public url`() {
        val me = newUser { withProfileImageKey("avatars/old.jpg") }
        val key = "avatars/${me.id}/new.jpg"
        every { objectStorageClient.head(key) } returns StoredObject(contentType = "image/jpeg", contentLength = 40_000)

        val body = mockMvc.put("/api/users/me/profile-image") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(ConfirmProfileImageRequest(key = key))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString

        assertThat(readBody<UserProfileResponse>(body).profileImageUrl).isEqualTo("https://img.test/$key")
        assertThat(reloadedKey(me)).isEqualTo(key)
        verify(exactly = 1) { objectStorageClient.delete("avatars/old.jpg") }
    }

    @Test
    fun `confirming the current key again keeps the object`() {
        val me = newUser()
        val key = "avatars/${me.id}/same.jpg"
        me.profileImageKey = key
        entityManager.flush()
        every { objectStorageClient.head(key) } returns StoredObject(contentType = "image/jpeg", contentLength = 40_000)

        mockMvc.put("/api/users/me/profile-image") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(ConfirmProfileImageRequest(key = key))
        }.andExpect { status { isOk() } }

        verify(exactly = 0) { objectStorageClient.delete(any()) }
    }

    @Test
    fun `confirm rejects a key outside the user's prefix`() {
        val other = newUser()
        val me = newUser()

        mockMvc.put("/api/users/me/profile-image") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(ConfirmProfileImageRequest(key = "avatars/${other.id}/x.jpg"))
        }.andExpect { status { isBadRequest() } }

        assertThat(reloadedKey(me)).isNull()
        verify(exactly = 0) { objectStorageClient.head(any()) }
    }

    @Test
    fun `confirm before the upload landed returns 400`() {
        val me = newUser()
        val key = "avatars/${me.id}/missing.jpg"
        every { objectStorageClient.head(key) } returns null

        mockMvc.put("/api/users/me/profile-image") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(ConfirmProfileImageRequest(key = key))
        }.andExpect { status { isBadRequest() } }

        assertThat(reloadedKey(me)).isNull()
    }

    @Test
    fun `confirm deletes an oversized upload and leaves the profile unchanged`() {
        val me = newUser()
        val key = "avatars/${me.id}/huge.jpg"
        every { objectStorageClient.head(key) } returns
            StoredObject(contentType = "image/jpeg", contentLength = 5L * 1024 * 1024 + 1)

        mockMvc.put("/api/users/me/profile-image") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(ConfirmProfileImageRequest(key = key))
        }.andExpect { status { isBadRequest() } }

        assertThat(reloadedKey(me)).isNull()
        verify(exactly = 1) { objectStorageClient.delete(key) }
    }

    @Test
    fun `DELETE profile-image clears the key and deletes the object`() {
        val me = newUser { withProfileImageKey("avatars/x/current.jpg") }

        val body = mockMvc.delete("/api/users/me/profile-image") {
            header("Authorization", bearer(me))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString

        assertThat(readBody<UserProfileResponse>(body).profileImageUrl).isNull()
        assertThat(reloadedKey(me)).isNull()
        verify(exactly = 1) { objectStorageClient.delete("avatars/x/current.jpg") }
    }

    @Test
    fun `GET profile returns the public url of the stored key`() {
        val me = newUser { withProfileImageKey("avatars/x/current.jpg") }

        val body = mockMvc.get("/api/users/me") {
            header("Authorization", bearer(me))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString

        assertThat(readBody<UserProfileResponse>(body).profileImageUrl).isEqualTo("https://img.test/avatars/x/current.jpg")
    }

    @Test
    fun `account deletion clears the key and deletes the object`() {
        val me = newUser { withProfileImageKey("avatars/x/current.jpg") }

        mockMvc.delete("/api/users/me") {
            header("Authorization", bearer(me))
        }.andExpect { status { isNoContent() } }

        assertThat(reloadedKey(me)).isNull()
        verify(exactly = 1) { objectStorageClient.delete("avatars/x/current.jpg") }
    }
}
