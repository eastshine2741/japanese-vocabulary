package com.japanese.vocabulary.karaoke.batch

import com.japanese.vocabulary.common.text.ArtistNameNormalizer
import com.japanese.vocabulary.karaoke.dto.KaraokeSongRegistration
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
import com.japanese.vocabulary.karaoke.service.KaraokeCatalogService
import com.japanese.vocabulary.karaoke.service.KaraokeSongService
import com.japanese.vocabulary.karaoke.service.KaraokeTitleCleaner
import com.japanese.vocabulary.karaokelisting.KaraokeListing
import com.japanese.vocabulary.karaokelisting.KaraokeListingVendor
import com.japanese.vocabulary.karaokelisting.KyClient
import com.japanese.vocabulary.karaokelisting.TjClient
import com.japanese.vocabulary.songsearch.client.applemusic.AppleMusicClient
import com.japanese.vocabulary.songsearch.dto.SongSearchItemDto
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.time.LocalDate
import java.time.YearMonth

/**
 * TJ·금영 신곡 중 일본곡을 골라 원장에 넣는다. 일본곡 판정은 노래방 자체 분류를 쓴다:
 * TJ 는 일본곡 필터 검색, 금영은 일본곡 노래책과 검색에 실린 가사의 가나 줄 비율.
 */
@Component
class KaraokeListingCollector(
    private val tjClient: TjClient,
    private val kyClient: KyClient,
    private val appleMusicClient: AppleMusicClient,
    private val karaokeSongService: KaraokeSongService,
    private val karaokeCatalogService: KaraokeCatalogService,
) {
    private val logger = LoggerFactory.getLogger(KaraokeListingCollector::class.java)

    data class Result(val registered: Int, val failedVendors: List<KaraokeListingVendor>)

    /** [backfill] 은 첫 배포용으로, TJ 의 지난달 1일부터 전부 넣는다. */
    fun collect(today: LocalDate, backfill: Boolean): Result {
        val failed = mutableListOf<KaraokeListingVendor>()
        val listings = mutableListOf<KaraokeListing>()
        runVendor(KaraokeListingVendor.TJ, failed) { listings += newTjJapanese(today, backfill) }
        runVendor(KaraokeListingVendor.KY, failed) { listings += newKyJapanese(today) }

        val registered = listings.count { listing ->
            karaokeSongService.register(toRegistration(listing, today)) != null
        }
        logger.info("karaokeCollect today={} backfill={} found={} registered={}", today, backfill, listings.size, registered)
        return Result(registered, failed)
    }

    private fun newTjJapanese(today: LocalDate, backfill: Boolean): List<KaraokeListing> {
        val since = today.minusDays(TJ_LOOKBACK_DAYS)
        val candidates = tjClient.newSongs(YearMonth.from(today).minusMonths(1))
            .filter { backfill || !requireNotNull(it.listedOn).isBefore(since) }
            .filterNot { HANGUL.containsMatchIn(it.title + it.artist) }
        val registered = karaokeSongService.registeredNumbers(KaraokeVendor.TJ, candidates.map { it.number })
        return candidates.filter { it.number !in registered && tjClient.isJapanese(it.number) }
    }

    /**
     * 금영은 신곡을 최신곡 페이지보다 한 달쯤 먼저 카탈로그에 올린다. 노래책과 어제까지 본 번호를 비교해 새 번호를 찾고,
     * 노래책에서 빠지는 곡이 있어 새 번호와 최근 등록 번호의 양옆을 곡번호 검색으로 훑는다.
     * 번호 대역과 방향은 가끔 바뀌므로 가정하지 않는다.
     */
    private fun newKyJapanese(today: LocalDate): List<KaraokeListing> {
        val registered = karaokeSongService.findAllByVendor(KaraokeVendor.KY)
        val registeredNumbers = registered.map { it.number }.toSet()
        val seen = karaokeCatalogService.seenNumbers(KaraokeVendor.KY)
        val book = kyClient.bookNumbers()
        // 첫 실행은 기준선만 깐다. 그 전에 놓친 곡은 이웃 검색이 원장 기준으로 찾는다.
        val newInBook = if (seen.isEmpty()) emptySet() else book - seen
        val recent = registered.filter { !it.listedOn.isBefore(today.minusDays(KY_ANCHOR_DAYS)) }.map { it.number }
        val found = probeNeighbors(newInBook + recent, registeredNumbers, YearMonth.from(today))
        karaokeCatalogService.markSeen(KaraokeVendor.KY, book, today)

        val staleSince = today.minusDays(KY_STALE_DAYS)
        check(found.isNotEmpty() || registered.any { !it.listedOn.isBefore(staleSince) }) {
            "no new KY Japanese song for $KY_STALE_DAYS days; its number band may have moved"
        }
        return found
    }

    private fun probeNeighbors(anchors: Set<Int>, registered: Set<Int>, since: YearMonth): List<KaraokeListing> {
        val checked = mutableMapOf<Int, KaraokeListing?>()
        // 출시월은 실제보다 앞서 붙으므로 새 곡은 이번 달 이상이다. 오래된 곡은 여기서 걸러져 훑기가 멈춘다.
        fun freshJapanese(number: Int) = checked.getOrPut(number) {
            kyClient.song(number)?.takeIf { song ->
                song.kanaLineRatio >= KY_KANA_LINE_RATIO && song.releaseMonth?.let { it >= since } == true
            }
        }
        for (anchor in anchors.sorted()) {
            if (anchor !in registered) freshJapanese(anchor)
            for (step in intArrayOf(-1, 1)) {
                var number = anchor + step
                var misses = 0
                while (misses < KY_PROBE_MISSES) {
                    if (number in registered || freshJapanese(number) != null) misses = 0 else misses++
                    number += step
                }
            }
        }
        return checked.values.filterNotNull()
    }

    private fun toRegistration(listing: KaraokeListing, today: LocalDate): KaraokeSongRegistration {
        val match = findCatalogMatch(listing)
        return KaraokeSongRegistration(
            vendor = KaraokeVendor.valueOf(listing.vendor.name),
            number = listing.number,
            title = match?.title ?: KaraokeTitleCleaner.cleanTitle(listing.title),
            artist = match?.artistName ?: KaraokeTitleCleaner.cleanArtist(listing.artist),
            artworkUrl = match?.thumbnail,
            durationSeconds = match?.durationSeconds?.takeIf { it > 0 },
            listedOn = listing.listedOn ?: today,
        )
    }

    // Apple Music 표기가 곡의 이름이 된다: 유저가 검색으로 만든 곡과 같은 키로 만나고, 금영의 잘린 표기도 복원된다.
    private fun findCatalogMatch(listing: KaraokeListing): SongSearchItemDto? {
        val title = KaraokeTitleCleaner.cleanTitle(listing.title)
        val items = try {
            appleMusicClient.search("$title ${KaraokeTitleCleaner.cleanArtist(listing.artist)}").items
        } catch (e: Exception) {
            logger.warn("karaokeCollect Apple Music search failed vendor={} number={}", listing.vendor, listing.number, e)
            return null
        }
        val matches = items.filter { KaraokeTitleCleaner.sameSong(listing.title, listing.artist, it.title, it.artistName) }
        val wanted = ArtistNameNormalizer.normalize(title)
        return matches.firstOrNull { ArtistNameNormalizer.normalize(it.title) == wanted } ?: matches.firstOrNull()
    }

    private fun runVendor(vendor: KaraokeListingVendor, failed: MutableList<KaraokeListingVendor>, block: () -> Unit) {
        try {
            block()
        } catch (e: Exception) {
            logger.error("karaokeCollect vendor={} failed", vendor, e)
            failed += vendor
        }
    }

    private companion object {
        val HANGUL = Regex("[가-힣]")
        const val TJ_LOOKBACK_DAYS = 3L
        const val KY_KANA_LINE_RATIO = 0.3
        const val KY_ANCHOR_DAYS = 90L
        const val KY_STALE_DAYS = 45L
        const val KY_PROBE_MISSES = 3
    }
}
