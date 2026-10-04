package com.japanese.vocabulary.lyricsearch.utaitedb

import com.japanese.vocabulary.lyricsearch.SongQueryNormalizer
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.startsWith
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient

class UtaitedbClientTest {

    @Test
    fun `searches utaitedb and reports the hit as a UtaiteDB id`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo(startsWith("https://utaitedb.net/api/artists")))
            .andRespond(withSuccess("""{"items":[{"id":1157,"name":"みきとP"}]}""", MediaType.APPLICATION_JSON))
        server.expect(requestTo(startsWith("https://utaitedb.net/api/songs")))
            .andRespond(
                withSuccess(
                    """
                    {"items":[{"id":38167,"name":"ロキ","artistString":"みきとP feat. 鏡音リン","lengthSeconds":230,
                     "lyrics":[{"id":1,"cultureCodes":["ja"],"translationType":"Original","value":"歌詞"}]}]}
                    """.trimIndent(),
                    MediaType.APPLICATION_JSON,
                )
            )

        val result = UtaitedbClient(builder)
            .search(SongQueryNormalizer.normalize(title = "ロキ", artist = "みきとP", durationSeconds = 230))!!

        assertThat(result.utaitedbId).isEqualTo(38167)
        assertThat(result.vocadbId).isNull()
        assertThat(result.lyrics).isEqualTo("歌詞")
        server.verify()
    }
}
