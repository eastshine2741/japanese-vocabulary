package com.japanese.vocabulary.karaoke.repository

import com.japanese.vocabulary.karaoke.entity.KaraokeSongEntity
import com.japanese.vocabulary.karaoke.entity.KaraokeVendor
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface KaraokeSongRepository : JpaRepository<KaraokeSongEntity, Long> {
    fun findAllByVendorAndNumberIn(vendor: KaraokeVendor, numbers: Collection<Int>): List<KaraokeSongEntity>

    fun findAllBySongIdIsNull(): List<KaraokeSongEntity>

    fun findAllBySongIdIsNullAndTitleAndArtist(title: String, artist: String): List<KaraokeSongEntity>

    fun findAllByNotifiedAtIsNullOrderByIdAsc(): List<KaraokeSongEntity>

    fun findAllByListedOnBetweenOrderByListedOnDescIdAsc(from: LocalDate, to: LocalDate): List<KaraokeSongEntity>
}
