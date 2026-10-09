package com.japanese.vocabulary.karaokelisting

import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

/**
 * 금영 최신곡 페이지. 등재일은 주지 않고, 긴 제목·가수는 끝을 ".." 로 잘라서 준다.
 */
@Component
class KyClient(restClientBuilder: RestClient.Builder) {
    private val restClient = restClientBuilder.asBrowser("https://kysing.kr")

    fun latestSongs(): List<KaraokeListing> {
        val out = mutableListOf<KaraokeListing>()
        for (page in 1..MAX_PAGES) {
            val rows = page(page)
            if (rows.isEmpty()) break
            out += rows
        }
        return out
    }

    internal fun page(page: Int): List<KaraokeListing> {
        val html = restClient.get()
            .uri { it.path("/latest/").queryParam("s_page", page).build() }
            .retrieve()
            .body(String::class.java)
            ?: return emptyList()
        return parse(html)
    }

    internal fun parse(html: String): List<KaraokeListing> =
        Jsoup.parse(html).select("ul.search_chart_list").mapNotNull(::toListing)

    private fun toListing(row: Element): KaraokeListing? {
        val number = row.selectFirst("li.search_chart_num")?.text()?.trim()?.toIntOrNull() ?: return null
        val title = row.selectFirst("span.tit:not(.mo-art)")?.text()?.trim() ?: return null
        val artist = row.selectFirst("span.tit.mo-art")?.text()?.trim() ?: return null
        val lyrics = row.selectFirst("div.LyricsCont")?.let { cont ->
            cont.select("p.LyricsTit").remove()
            cont.html().split(Regex("<br\\s*/?>"))
                .map { Jsoup.parse(it).text().trim() }
                .filter { it.isNotEmpty() }
        }.orEmpty()
        return KaraokeListing(
            vendor = KaraokeListingVendor.KY,
            number = number,
            title = title,
            artist = artist,
            lyricLines = lyrics,
        )
    }

    private companion object {
        const val MAX_PAGES = 40
    }
}
