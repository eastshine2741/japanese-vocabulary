package com.japanese.vocabulary.karaokelisting

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import org.jsoup.Jsoup
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

@Component
class TjClient(restClientBuilder: RestClient.Builder) {
    private val restClient = restClientBuilder.asBrowser("https://www.tjmedia.com")

    /** [from] 달 1일부터 오늘까지 등재된 곡. 달을 넘겨도 오늘까지 이어서 준다. */
    fun newSongs(from: YearMonth): List<KaraokeListing> {
        val form = LinkedMultiValueMap<String, String>().apply { add("searchYm", from.format(YEAR_MONTH)) }
        val response = restClient.post()
            .uri("/legacy/api/newSongOfMonth")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(TjNewSongsResponse::class.java)
            ?: throw IllegalStateException("TJ new songs returned an empty body")
        return response.resultData.items.map {
            KaraokeListing(
                vendor = KaraokeListingVendor.TJ,
                number = it.pro,
                title = it.indexTitle.trim(),
                artist = it.indexSong.trim(),
                listedOn = LocalDate.parse(it.publishdate),
            )
        }
    }

    /** TJ 자체 국가 분류. 일본곡 필터를 건 곡번호 검색에 그 번호가 나오면 일본곡이다. */
    fun isJapanese(number: Int): Boolean {
        val html = restClient.get()
            .uri { it.path("/song/accompaniment_search")
                .queryParam("nationType", "JPN")
                .queryParam("strType", 16)
                .queryParam("searchTxt", number)
                .build() }
            .retrieve()
            .body(String::class.java)
            ?: return false
        return Jsoup.parse(html).select("span.num2").any { it.text().trim() == number.toString() }
    }

    private companion object {
        val YEAR_MONTH: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyyMM")
    }
}

@JsonIgnoreProperties(ignoreUnknown = true)
internal data class TjNewSongsResponse(val resultData: TjNewSongsData)

@JsonIgnoreProperties(ignoreUnknown = true)
internal data class TjNewSongsData(val items: List<TjNewSongItem> = emptyList())

@JsonIgnoreProperties(ignoreUnknown = true)
internal data class TjNewSongItem(
    val pro: Int,
    val indexTitle: String,
    val indexSong: String,
    val publishdate: String,
)
