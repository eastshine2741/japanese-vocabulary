package com.japanese.vocabulary.karaoke.repository

import com.japanese.vocabulary.karaoke.entity.KaraokeCatalogNumberEntity
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface KaraokeCatalogNumberRepository : JpaRepository<KaraokeCatalogNumberEntity, Long> {
    @Query("SELECT c.number FROM KaraokeCatalogNumberEntity c WHERE c.vendor = :vendor")
    fun findNumbersByVendor(vendor: KaraokeVendor): List<Int>
}
