package com.japanese.vocabulary.translation.client.jev

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.gemini.GeminiCallLogger
import com.japanese.vocabulary.translation.client.jev.dto.JevAnswer
import com.japanese.vocabulary.translation.client.jev.dto.JevChoiceQuestion
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.mockk
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.MediaType
import org.springframework.test.web.client.ExpectedCount
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.anything
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import java.time.Duration

class JevClientTest {

    private val context = GeminiCallContext(songId = 1, lyricId = 1)
    private val callLogger = mockk<GeminiCallLogger>(relaxed = true)
    private val questions = mapOf(
        "0:2:3:て" to JevChoiceQuestion("Which sense?", mapOf("84" to "please (do) (Particle)", "-1" to "None")),
    )

    @Test
    fun `posts choice questions with bearer auth and reads each answer`() {
        val (client, server) = clientWith { server ->
            server.expect(requestTo("https://api.typesafe.ai/v1/systemone"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer secret"))
                .andExpect(jsonPath("$.model").value("jev-latest"))
                .andExpect(jsonPath("$.state.japanese_line").value("殴って"))
                .andExpect(jsonPath("$.questions['0:2:3:て'].type").value("choice"))
                .andExpect(jsonPath("$.questions['0:2:3:て'].criteria.84").value("please (do) (Particle)"))
                .andRespond(withSuccess(RESPONSE, MediaType.APPLICATION_JSON))
        }

        val answers = client.choose("select", mapOf("japanese_line" to "殴って"), questions, context)

        assertThat(answers).containsExactlyEntriesOf(mapOf("0:2:3:て" to JevAnswer("84", 0.82)))
        server.verify()
        verify { callLogger.record(context, "select", "jev-1.13.0", any(), RESPONSE, null) }
    }

    @Test
    fun `retries Jev's 529 overload`() {
        val (client, server) = clientWith { server ->
            server.expect(anything()).andRespond(withStatus(HttpStatusCode.valueOf(529)))
            server.expect(anything()).andRespond(withSuccess(RESPONSE, MediaType.APPLICATION_JSON))
        }

        client.choose("select", emptyMap(), questions, context)

        server.verify()
    }

    @Test
    fun `does not retry a rejected key`() {
        val (client, server) = clientWith { server ->
            server.expect(ExpectedCount.once(), anything()).andRespond(withStatus(HttpStatus.UNAUTHORIZED))
        }

        assertThatThrownBy { client.choose("select", emptyMap(), questions, context) }
            .isInstanceOf(HttpClientErrorException::class.java)
        server.verify()
    }

    private fun clientWith(configure: (MockRestServiceServer) -> Unit): Pair<JevClient, MockRestServiceServer> {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        configure(server)
        val client = JevClient(
            restClientBuilder = builder,
            apiKey = "secret",
            model = "jev-latest",
            maxAttempts = 3,
            initialBackoff = Duration.ZERO,
            objectMapper = ObjectMapper().registerKotlinModule(),
            meterRegistry = SimpleMeterRegistry(),
            callLogger = callLogger,
        )
        return client to server
    }

    private companion object {
        val RESPONSE = """
            {"model":"jev-1.13.0",
             "answers":{"0:2:3:て":{"choice":"84","confidence":0.82,"probabilities":{"84":0.9,"-1":0.1}}},
             "usage":{"input_tokens":120,"output_tokens":30}}
        """.trimIndent()
    }
}
