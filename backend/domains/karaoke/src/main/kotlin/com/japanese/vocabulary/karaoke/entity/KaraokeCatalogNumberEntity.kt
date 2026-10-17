package com.japanese.vocabulary.karaoke.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EntityListeners
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant
import java.time.LocalDate

/** 노래방 카탈로그에서 한 번이라도 본 곡번호. 일본곡이 아니거나 오래된 곡도 남는다. */
@Entity
@Table(
    name = "karaoke_catalog_number",
    uniqueConstraints = [UniqueConstraint(name = "uk_karaoke_catalog_number_vendor_number", columnNames = ["vendor", "number"])],
)
@EntityListeners(AuditingEntityListener::class)
class KaraokeCatalogNumberEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    val vendor: KaraokeVendor,

    @Column(nullable = false)
    val number: Int,

    @Column(name = "first_seen_on", nullable = false)
    val firstSeenOn: LocalDate,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
)
