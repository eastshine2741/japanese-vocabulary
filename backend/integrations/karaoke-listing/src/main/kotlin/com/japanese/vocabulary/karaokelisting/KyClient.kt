package com.japanese.vocabulary.karaokelisting

import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.net.URLDecoder
import java.time.Duration
import java.time.YearMonth
import java.util.HexFormat
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * 금영 카탈로그(kysing.kr). 일본곡 노래책으로 번호 목록을, 곡번호 검색으로 곡 한 개를 읽는다.
 * 긴 제목·가수는 끝을 ".." 로 잘라서 준다.
 */
@Component
class KyClient(restClientBuilder: RestClient.Builder) {
    private val restClient = restClientBuilder.asBrowser("https://kysing.kr")
    private var cupidCookie: String? = null
    private var lastRequestAt = 0L

    // 요청이 몰리면 사이트가 IP 를 한동안 막는다.
    internal var minInterval: Duration = Duration.ofSeconds(1)

    /** 일본곡 노래책에 실린 모든 곡번호. 노래책은 제목 첫 글자별로 나뉘어 있다. */
    fun bookNumbers(): Set<Int> {
        val index = get(BOOK_PATH, mapOf("city" to "jp"))
        val initials = BOOK_INITIAL.findAll(index)
            .map { URLDecoder.decode(it.groupValues[1], Charsets.UTF_8) }
            .distinct()
            .toList()
        check(initials.isNotEmpty()) { "KY book index format changed" }
        val numbers = mutableSetOf<Int>()
        for (initial in initials) {
            for (page in 1..MAX_BOOK_PAGES) {
                val params = mapOf("city" to "jp", "s_cd" to "2", "s_page" to "$page", "s_value" to initial)
                val rows = parseBook(get(BOOK_PATH, params))
                if (rows.isEmpty()) break
                numbers += rows
            }
        }
        // 차단 페이지나 구조 변경이 "신곡 없음"으로 조용히 넘어가지 않게 한다.
        check(numbers.size >= MIN_BOOK_SONGS) { "KY book has only ${numbers.size} songs" }
        return numbers
    }

    /** 곡번호 검색. 카탈로그에 없는 번호면 null. */
    fun song(number: Int): KaraokeListing? =
        parseChart(get(SEARCH_PATH, mapOf("category" to SEARCH_BY_NUMBER, "keyword" to "$number")))
            .firstOrNull { it.number == number }

    private fun get(path: String, params: Map<String, String>): String {
        var html = fetch(path, params)
        if (CHALLENGE_MARKER in html) {
            cupidCookie = solveChallenge(html)
            html = fetch(path, params)
            check(CHALLENGE_MARKER !in html) { "KY bot challenge not passed" }
        }
        check(BLOCKED_MARKER !in html) { "KY blocked our requests" }
        return html
    }

    private fun fetch(path: String, params: Map<String, String>): String {
        throttle()
        return restClient.get()
            .uri { builder ->
                builder.path(path)
                params.forEach { (name, value) -> builder.queryParam(name, value) }
                builder.build()
            }
            .headers { headers -> cupidCookie?.let { headers.set(HttpHeaders.COOKIE, "CUPID=$it") } }
            .retrieve()
            .body(String::class.java)
            .orEmpty()
    }

    private fun throttle() {
        val wait = minInterval.toNanos() - (System.nanoTime() - lastRequestAt)
        if (lastRequestAt != 0L && wait > 0) Thread.sleep(Duration.ofNanos(wait).toMillis())
        lastRequestAt = System.nanoTime()
    }

    // title 속성에 따옴표가 이스케이프 없이 들어 있어(("ドラマ"…")) 속성 대신 본문을 읽는다.
    internal fun parseBook(html: String): List<Int> =
        Jsoup.parse(html).select("li.index_search_num").mapNotNull { it.text().trim().toIntOrNull() }

    internal fun parseChart(html: String): List<KaraokeListing> =
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
        val releaseMonth = row.selectFirst("li.search_chart_rel")?.text()?.trim()
            ?.let { RELEASE_MONTH.matchEntire(it) }
            ?.let { YearMonth.of(it.groupValues[1].toInt(), it.groupValues[2].toInt()) }
        return KaraokeListing(
            vendor = KaraokeListingVendor.KY,
            number = number,
            title = title,
            artist = artist,
            lyricLines = lyrics,
            releaseMonth = releaseMonth,
        )
    }

    private companion object {
        const val BOOK_PATH = "/karaoke-book/"
        const val SEARCH_PATH = "/search/"
        const val SEARCH_BY_NUMBER = "1"
        const val MAX_BOOK_PAGES = 50
        const val MIN_BOOK_SONGS = 3000
        const val CHALLENGE_MARKER = "slowAES.decrypt"
        const val BLOCKED_MARKER = "사이트 소유자에 의해"
        val BOOK_INITIAL = Regex("""s_cd=2&(?:amp;)?s_page=1&(?:amp;)?s_value=([^"'&]+)""")
        val RELEASE_MONTH = Regex("""(\d{4})\.(\d{1,2})""")
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
