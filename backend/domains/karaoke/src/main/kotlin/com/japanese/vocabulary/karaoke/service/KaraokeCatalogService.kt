package com.japanese.vocabulary.karaoke.service

import com.japanese.vocabulary.karaoke.entity.KaraokeCatalogNumberEntity
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
import com.japanese.vocabulary.karaoke.repository.KaraokeCatalogNumberRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

@Service
class KaraokeCatalogService(
    private val catalogNumberRepository: KaraokeCatalogNumberRepository,
) {
    @Transactional(readOnly = true)
    fun seenNumbers(vendor: KaraokeVendor): Set<Int> = catalogNumberRepository.findNumbersByVendor(vendor).toSet()

    @Transactional
    fun markSeen(vendor: KaraokeVendor, numbers: Collection<Int>, on: LocalDate) {
        val seen = seenNumbers(vendor)
        catalogNumberRepository.saveAll(
            numbers.filterNot { it in seen }.map { KaraokeCatalogNumberEntity(vendor = vendor, number = it, firstSeenOn = on) }
        )
    }
}
