package com.japanese.vocabulary.test

import com.japanese.vocabulary.song.client.itunes.ItunesClient
import com.japanese.vocabulary.song.client.lrclib.LrclibClient
import com.japanese.vocabulary.song.client.vocadb.VocadbClient
import com.japanese.vocabulary.song.client.youtube.YoutubeClient
import com.japanese.vocabulary.word.client.jisho.JishoClient
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import org.junit.jupiter.api.BeforeEach

/**
 * api 모듈 통합테스트 부모. 외부 클라이언트(WebClient 기반)는 부모에서 일괄 mock해
 * ApplicationContext cache key 를 안정화한다.
 */
abstract class ApiBaseIntegrationTest : BaseIntegrationTest() {

    @MockkBean(relaxed = true)
    protected lateinit var jishoClient: JishoClient

    @MockkBean(relaxed = true)
    protected lateinit var lrclibClient: LrclibClient

    @MockkBean(relaxed = true)
    protected lateinit var vocadbClient: VocadbClient

    @MockkBean(relaxed = true)
    protected lateinit var youtubeClient: YoutubeClient

    @MockkBean(relaxed = true)
    protected lateinit var itunesClient: ItunesClient

    @BeforeEach
    fun resetClientMocks() {
        clearMocks(jishoClient, lrclibClient, vocadbClient, youtubeClient, itunesClient)
    }
}
