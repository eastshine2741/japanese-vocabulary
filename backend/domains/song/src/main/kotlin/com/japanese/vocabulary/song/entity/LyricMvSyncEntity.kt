package com.japanese.vocabulary.song.entity

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.config.converter.JsonListConverter
import com.japanese.vocabulary.song.model.LyricLineTiming
import jakarta.persistence.AttributeConverter
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Converter
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

enum class LyricMvSyncStatus { PENDING, RUNNING, COMPLETED, FAILED }

enum class LyricMvSyncMethod { OFFSET, ALIGNED }

/** 실행기가 MV 를 받지 못한 이유. 연령 제한은 YouTube 에 로그인하면 볼 수 있고, 나머지는 영상 자체가 없다. */
enum class MvUnavailableReason { AGE_RESTRICTED, UNAVAILABLE }

/** 가사 하나를 MV 하나에 맞춘 줄 시각. 행이 로컬 실행기의 작업 원장이기도 하다(V52). */
@Entity
@Table(name = "lyric_mv_sync")
class LyricMvSyncEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "lyric_id", nullable = false)
    val lyricId: Long,

    @Column(name = "youtube_video_id", nullable = false, length = 11)
    val youtubeVideoId: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: LyricMvSyncStatus = LyricMvSyncStatus.PENDING,

    @Column(nullable = false)
    var attempt: Int = 0,

    @Column(name = "lease_until")
    var leaseUntil: Instant? = null,

    @Enumerated(EnumType.STRING)
    var method: LyricMvSyncMethod? = null,

    @Convert(converter = LyricLineTimingListConverter::class)
    @Column(name = "line_timings", columnDefinition = "JSON")
    var lineTimings: List<LyricLineTiming>? = null,

    @Convert(converter = JsonMapConverter::class)
    @Column(columnDefinition = "JSON")
    var confidence: Map<String, Any?>? = null,

    @Column(name = "error_message", length = 1000)
    var errorMessage: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "mv_unavailable", length = 20)
    var mvUnavailable: MvUnavailableReason? = null,

    @Column(name = "completed_at")
    var completedAt: Instant? = null,
)

@Converter
class LyricLineTimingListConverter : JsonListConverter<LyricLineTiming>(LyricLineTiming::class.java)

@Converter
class JsonMapConverter : AttributeConverter<Map<String, Any?>, String> {
    private val objectMapper = jacksonObjectMapper()

    override fun convertToDatabaseColumn(attribute: Map<String, Any?>?): String? =
        attribute?.let { objectMapper.writeValueAsString(it) }

    override fun convertToEntityAttribute(dbData: String?): Map<String, Any?>? =
        dbData?.takeIf { it.isNotBlank() }?.let { objectMapper.readValue(it) }
}
