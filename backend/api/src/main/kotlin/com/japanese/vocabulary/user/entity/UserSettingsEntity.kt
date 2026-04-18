package com.japanese.vocabulary.user.entity

import com.japanese.vocabulary.config.converter.UserSettingsJsonConverter
import com.japanese.vocabulary.user.dto.UserSettingsData
import jakarta.persistence.*

@Entity
@Table(name = "user_settings")
class UserSettingsEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false, unique = true)
    val userId: Long,

    @Column(name = "settings", columnDefinition = "JSON")
    @Convert(converter = UserSettingsJsonConverter::class)
    var settings: UserSettingsData = UserSettingsData()
)
