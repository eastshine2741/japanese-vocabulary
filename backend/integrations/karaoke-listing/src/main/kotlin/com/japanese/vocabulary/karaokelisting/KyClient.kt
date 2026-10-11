package com.japanese.vocabulary.karaokelisting

import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.util.HexFormat
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * 금영 최신곡 페이지. 등재일은 주지 않고, 긴 제목·가수는 끝을 ".." 로 잘라서 준다.
 */
@Component
class KyClient(restClientBuilder: RestClient.Builder) {
    private val restClient = restClientBuilder.asBrowser("https://kysing.kr")
    private var cupidCookie: String? = null

    fun latestSongs(): List<KaraokeListing> {
        val out = mutableListOf<KaraokeListing>()
        for (page in 1..MAX_PAGES) {
            val rows = page(page)
            if (rows.isEmpty()) break
            out += rows
        }
        // 차단 페이지나 구조 변경이 "신곡 없음"으로 조용히 넘어가지 않게 한다.
        check(out.isNotEmpty()) { "KY latest page has no song rows" }
        return out
    }

    internal fun page(page: Int): List<KaraokeListing> {
        var html = fetch(page)
        if (CHALLENGE_MARKER in html) {
            cupidCookie = solveChallenge(html)
            html = fetch(page)
            check(CHALLENGE_MARKER !in html) { "KY bot challenge not passed" }
        }
        return parse(html)
    }

    private fun fetch(page: Int): String =
        restClient.get()
            .uri { it.path("/latest/").queryParam("s_page", page).build() }
            .headers { headers -> cupidCookie?.let { headers.set(HttpHeaders.COOKIE, "CUPID=$it") } }
            .retrieve()
            .body(String::class.java)
            .orEmpty()

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
        const val CHALLENGE_MARKER = "slowAES.decrypt"
        val HEX: HexFormat = HexFormat.of()
        val CHALLENGE_HEX = Regex("""toNumbers\("([0-9a-f]+)"\)""")

        // prod(Hetzner) IP 에 주는 JS 쿠키 챌린지: CUPID = hex(slowAES.decrypt(c, CBC, key=a, iv=b)).
        fun solveChallenge(html: String): String {
            val (key, iv, cipherText) = CHALLENGE_HEX.findAll(html).map { HEX.parseHex(it.groupValues[1]) }.toList()
                .takeIf { it.size == 3 } ?: error("KY bot challenge format changed")
            val cipher = Cipher.getInstance("AES/CBC/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
            return HEX.formatHex(cipher.doFinal(cipherText))
        }
    }
}
