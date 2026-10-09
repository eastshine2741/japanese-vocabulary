package com.japanese.vocabulary.karaoke.batch

import com.japanese.vocabulary.common.text.ArtistNameNormalizer
import com.japanese.vocabulary.karaoke.dto.KaraokeSongRegistration
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
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
 * TJ 는 일본곡 필터 검색, 금영은 목록에 실린 가사의 가나 줄 비율.
 */
@Component
class KaraokeListingCollector(
    private val tjClient: TjClient,
    private val kyClient: KyClient,
    private val appleMusicClient: AppleMusicClient,
    private val karaokeSongService: KaraokeSongService,
) {
    private val logger = LoggerFactory.getLogger(KaraokeListingCollector::class.java)

    data class Result(val registered: Int, val failedVendors: List<KaraokeListingVendor>)

    /** [backfill] 은 첫 배포용으로, TJ 의 지난달 1일부터 전부 넣는다. */
    fun collect(today: LocalDate, backfill: Boolean): Result {
        val failed = mutableListOf<KaraokeListingVendor>()
        val listings = mutableListOf<KaraokeListing>()
        runVendor(KaraokeListingVendor.TJ, failed) { listings += newTjJapanese(today, backfill) }
        runVendor(KaraokeListingVendor.KY, failed) { listings += newKyJapanese() }

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

    private fun newKyJapanese(): List<KaraokeListing> {
        val candidates = kyClient.latestSongs().filter { it.kanaLineRatio >= KY_KANA_LINE_RATIO }
        val registered = karaokeSongService.registeredNumbers(KaraokeVendor.KY, candidates.map { it.number })
        return candidates.filter { it.number !in registered }
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
    }
}
