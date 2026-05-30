package com.japanese.vocabulary.auth

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.auth.dto.AuthResponse
import com.japanese.vocabulary.auth.dto.GoogleAuthRequest
import com.japanese.vocabulary.auth.dto.GoogleLoginResponse
import com.japanese.vocabulary.auth.dto.GoogleSignupRequest
import com.japanese.vocabulary.auth.dto.UsernameAvailabilityResponse
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.auth.service.VerifiedGoogleIdentity
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.repository.UserRepository
import io.mockk.every
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@AutoConfigureMockMvc
class AuthControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var userRepository: UserRepository
    @Autowired private lateinit var jwtUtil: JwtUtil

    private fun newUserBuilder() = TestUserBuilder(entityManager)

    private fun postJson(path: String, body: Any) = mockMvc.post(path) {
        contentType = MediaType.APPLICATION_JSON
        content = objectMapper.writeValueAsString(body)
    }

    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json, T::class.java)

    @Nested
    inner class GoogleLogin {

        @Test
        fun `existing identity returns authenticated with usable JWT`() {
            val user = newUserBuilder()
                .withProviderSub("google-sub-1")
                .withUsername("alice")
                .withName("Alice")
                .build()
            every { googleOidcService.verify("token") } returns
                VerifiedGoogleIdentity(sub = "google-sub-1", email = "alice@example.com", name = "Alice")

            val result = postJson("/api/auth/google", GoogleAuthRequest("token"))
                .andExpect { status { isOk() } }
                .andReturn().response.contentAsString

            val body = readBody<GoogleLoginResponse>(result)
            assertThat(body.kind).isEqualTo(GoogleLoginResponse.Kind.authenticated)
            assertThat(body.username).isEqualTo("alice")
            assertThat(body.name).isEqualTo("Alice")
            assertThat(body.token).isNotBlank()
            assertThat(jwtUtil.getUserId(body.token!!)).isEqualTo(user.id)
        }

        @Test
        fun `unknown identity returns needsSignup with verified payload`() {
            every { googleOidcService.verify("token") } returns
                VerifiedGoogleIdentity(sub = "new-sub", email = "new@example.com", name = "New User")

            val result = postJson("/api/auth/google", GoogleAuthRequest("token"))
                .andExpect { status { isOk() } }
                .andReturn().response.contentAsString

            val body = readBody<GoogleLoginResponse>(result)
            assertThat(body.kind).isEqualTo(GoogleLoginResponse.Kind.needsSignup)
            assertThat(body.token).isNull()
            assertThat(body.identity?.sub).isEqualTo("new-sub")
            assertThat(body.identity?.email).isEqualTo("new@example.com")
            assertThat(body.identity?.name).isEqualTo("New User")
        }

        @Test
        fun `invalid id token returns 401`() {
            every { googleOidcService.verify(any()) } throws BusinessException(ErrorCode.INVALID_CREDENTIALS)

            postJson("/api/auth/google", GoogleAuthRequest("bad"))
                .andExpect { status { isUnauthorized() } }
        }

        @Test
        fun `re-login refreshes email from Google when changed`() {
            val user = newUserBuilder()
                .withProviderSub("sub-email-sync")
                .withEmail("old@example.com")
                .build()
            every { googleOidcService.verify("token") } returns
                VerifiedGoogleIdentity(sub = "sub-email-sync", email = "new@example.com", name = null)

            postJson("/api/auth/google", GoogleAuthRequest("token"))
                .andExpect { status { isOk() } }

            entityManager.flush()
            entityManager.clear()
            val reloaded = userRepository.findById(user.id!!).get()
            assertThat(reloaded.email).isEqualTo("new@example.com")
        }
    }

    @Nested
    inner class Signup {

        @Test
        fun `new identity creates user and returns JWT`() {
            every { googleOidcService.verify("token") } returns
                VerifiedGoogleIdentity(sub = "fresh-sub", email = "fresh@example.com", name = "Fresh")

            val result = postJson(
                "/api/auth/google/signup",
                GoogleSignupRequest(idToken = "token", username = "freshuser", displayName = "Fresh"),
            ).andExpect { status { isOk() } }
                .andReturn().response.contentAsString

            val body = readBody<AuthResponse>(result)
            assertThat(body.username).isEqualTo("freshuser")
            assertThat(body.name).isEqualTo("Fresh")

            val persisted = userRepository.findByProviderAndProviderSub("google", "fresh-sub")
            assertThat(persisted).isNotNull
            assertThat(persisted!!.username).isEqualTo("freshuser")
            assertThat(persisted.email).isEqualTo("fresh@example.com")
            assertThat(jwtUtil.getUserId(body.token)).isEqualTo(persisted.id)
        }

        @Test
        fun `username is normalized (trimmed and lowercased) before persisting`() {
            every { googleOidcService.verify("token") } returns
                VerifiedGoogleIdentity(sub = "norm-sub", email = null, name = null)

            postJson(
                "/api/auth/google/signup",
                GoogleSignupRequest(idToken = "token", username = "  AliceX  ", displayName = null),
            ).andExpect { status { isOk() } }

            val persisted = userRepository.findByProviderAndProviderSub("google", "norm-sub")
            assertThat(persisted?.username).isEqualTo("alicex")
        }

        @Test
        fun `invalid username format returns 400`() {
            every { googleOidcService.verify("token") } returns
                VerifiedGoogleIdentity(sub = "bad-name-sub", email = null, name = null)

            postJson(
                "/api/auth/google/signup",
                GoogleSignupRequest(idToken = "token", username = "ab", displayName = null),
            ).andExpect { status { isBadRequest() } }

            assertThat(userRepository.findByProviderAndProviderSub("google", "bad-name-sub")).isNull()
        }

        @Test
        fun `reserved username returns 400`() {
            every { googleOidcService.verify("token") } returns
                VerifiedGoogleIdentity(sub = "reserved-sub", email = null, name = null)

            postJson(
                "/api/auth/google/signup",
                GoogleSignupRequest(idToken = "token", username = "admin", displayName = null),
            ).andExpect { status { isBadRequest() } }

            assertThat(userRepository.findByProviderAndProviderSub("google", "reserved-sub")).isNull()
        }

        @Test
        fun `duplicate signup with same identity is idempotent`() {
            every { googleOidcService.verify("token") } returns
                VerifiedGoogleIdentity(sub = "idem-sub", email = "idem@example.com", name = "Idem")

            val first = readBody<AuthResponse>(
                postJson(
                    "/api/auth/google/signup",
                    GoogleSignupRequest(idToken = "token", username = "idemuser", displayName = "Idem"),
                ).andExpect { status { isOk() } }.andReturn().response.contentAsString,
            )

            val second = readBody<AuthResponse>(
                postJson(
                    "/api/auth/google/signup",
                    GoogleSignupRequest(idToken = "token", username = "different", displayName = "Other"),
                ).andExpect { status { isOk() } }.andReturn().response.contentAsString,
            )

            assertThat(second.username).isEqualTo(first.username)
            assertThat(jwtUtil.getUserId(second.token)).isEqualTo(jwtUtil.getUserId(first.token))
        }

        @Test
        fun `username collision with another user returns 409`() {
            newUserBuilder().withUsername("taken").build()
            every { googleOidcService.verify("token") } returns
                VerifiedGoogleIdentity(sub = "collision-sub", email = null, name = null)

            postJson(
                "/api/auth/google/signup",
                GoogleSignupRequest(idToken = "token", username = "taken", displayName = null),
            ).andExpect { status { isConflict() } }

            assertThat(userRepository.findByProviderAndProviderSub("google", "collision-sub")).isNull()
        }
    }

    @Nested
    inner class CheckUsername {

        @Test
        fun `available username returns true`() {
            val result = mockMvc.get("/api/auth/username/available") { param("username", "freecandidate") }
                .andExpect { status { isOk() } }
                .andReturn().response.contentAsString

            val body = readBody<UsernameAvailabilityResponse>(result)
            assertThat(body.available).isTrue
            assertThat(body.reason).isNull()
        }

        @Test
        fun `invalid format returns INVALID_FORMAT`() {
            val result = mockMvc.get("/api/auth/username/available") { param("username", "ab") }
                .andExpect { status { isOk() } }
                .andReturn().response.contentAsString

            val body = readBody<UsernameAvailabilityResponse>(result)
            assertThat(body.available).isFalse
            assertThat(body.reason).isEqualTo(UsernameAvailabilityResponse.REASON_INVALID_FORMAT)
        }

        @Test
        fun `reserved name returns RESERVED`() {
            val result = mockMvc.get("/api/auth/username/available") { param("username", "admin") }
                .andExpect { status { isOk() } }
                .andReturn().response.contentAsString

            val body = readBody<UsernameAvailabilityResponse>(result)
            assertThat(body.available).isFalse
            assertThat(body.reason).isEqualTo(UsernameAvailabilityResponse.REASON_RESERVED)
        }

        @Test
        fun `name owned by another user returns TAKEN`() {
            newUserBuilder().withUsername("occupied").build()

            val result = mockMvc.get("/api/auth/username/available") { param("username", "occupied") }
                .andExpect { status { isOk() } }
                .andReturn().response.contentAsString

            val body = readBody<UsernameAvailabilityResponse>(result)
            assertThat(body.available).isFalse
            assertThat(body.reason).isEqualTo(UsernameAvailabilityResponse.REASON_TAKEN)
        }

        @Test
        fun `own username is available for authenticated caller (JwtAuthFilter)`() {
            val me = newUserBuilder().withUsername("mine").build()
            val jwt = jwtUtil.generateToken(me.id!!, me.username)

            val result = mockMvc.get("/api/auth/username/available") {
                param("username", "mine")
                header("Authorization", "Bearer $jwt")
            }
                .andExpect { status { isOk() } }
                .andReturn().response.contentAsString

            val body = readBody<UsernameAvailabilityResponse>(result)
            assertThat(body.available).isTrue
        }
    }
}
