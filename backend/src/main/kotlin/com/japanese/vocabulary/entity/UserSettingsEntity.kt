package com.japanese.vocabulary.entity

import jakarta.persistence.*

@Entity
@Table(name = "user_settings")
class UserSettingsEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false, unique = true)
    val userId: Long,

    @Column(name = "request_retention", nullable = false)
    var requestRetention: Double = 0.9,

    @Column(name = "show_intervals", nullable = false)
    var showIntervals: Boolean = true
)
