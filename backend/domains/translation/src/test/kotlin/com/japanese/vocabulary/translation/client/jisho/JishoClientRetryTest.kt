package com.japanese.vocabulary.translation.client.jisho

import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.ExpectedCount
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.anything
import org.springframework.test.web.client.response.MockRestResponseCreators.withException
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import java.io.IOException
import java.time.Duration

class JishoClientRetryTest {

    @Test
    fun `retries a 5xx and returns the later answer`(): Unit = runBlocking {
        // songId=82 shipped 太陽 and 花束 with no meaning because one 502 was taken as the final word.
        val (client, server) = clientWith { server ->
            server.expect(anything()).andRespond(withStatus(HttpStatus.BAD_GATEWAY))
            server.expect(anything()).andRespond(withSuccess(found("太陽", "たいよう"), MediaType.APPLICATION_JSON))
        }

        val entry = client.fetch("太陽")

        assertThat(entry?.provenance).isEqualTo(JishoLookupProvenance.EXACT)
        server.verify()
    }

    @Test
    fun `retries a dropped connection`(): Unit = runBlocking {
        val (client, server) = clientWith { server ->
            server.expect(anything()).andRespond(withException(IOException("failed to respond")))
            server.expect(anything()).andRespond(withSuccess(found("太陽", "たいよう"), MediaType.APPLICATION_JSON))
        }

        assertThat(client.fetch("太陽")?.found).isTrue()
        server.verify()
    }

    @Test
    fun `gives up after the configured attempts and reports an error, not a miss`(): Unit = runBlocking {
        val (client, server) = clientWith(maxAttempts = 3) { server ->
            server.expect(ExpectedCount.times(3), anything()).andRespond(withStatus(HttpStatus.BAD_GATEWAY))
        }

        // null is the error signal JishoService turns into FETCH_ERROR; a NOT_FOUND here would be cached.
        assertThat(client.fetch("太陽")).isNull()
        server.verify()
    }

    @Test
    fun `does not retry a 4xx`(): Unit = runBlocking {
        val (client, server) = clientWith { server ->
            server.expect(ExpectedCount.once(), anything()).andRespond(withStatus(HttpStatus.BAD_REQUEST))
        }

        assertThat(client.fetch("太陽")).isNull()
        server.verify()
    }

    private fun found(word: String, reading: String) = """
        {"data":[{"japanese":[{"word":"$word","reading":"$reading"}],"senses":[{"english_definitions":["sun"],"parts_of_speech":["Noun"]}]}]}
    """.trimIndent()

    private fun clientWith(
        maxAttempts: Int = 3,
        expectations: (MockRestServiceServer) -> Unit,
    ): Pair<JishoClient, MockRestServiceServer> {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        expectations(server)
        return JishoClient(builder, maxAttempts = maxAttempts, initialBackoff = Duration.ZERO) to server
    }
}
