package com.japanese.vocabulary.song.entity

import com.japanese.vocabulary.config.converter.AnalyzedLineListConverter
import com.japanese.vocabulary.config.converter.LyricLineDataListConverter
import com.japanese.vocabulary.song.dto.AnalyzedLine
import com.japanese.vocabulary.song.dto.LyricLineData
import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "lyrics")
class LyricEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(name = "song_id", nullable = false, unique = true)
    val songId: Long,
    @Enumerated(EnumType.STRING)
    @Column(name = "lyric_type", nullable = false)
    var lyricType: LyricType,
    @Convert(converter = LyricLineDataListConverter::class)
    @Column(name = "raw_content", columnDefinition = "JSON")
    var rawContent: List<LyricLineData>,
    @Convert(converter = AnalyzedLineListConverter::class)
    @Column(name = "analyzed_content", columnDefinition = "JSON")
    var analyzedContent: List<AnalyzedLine>? = null,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: KoreanLyricStatus = KoreanLyricStatus.PENDING,
    @Column(name = "retry_count", nullable = false)
    var retryCount: Int = 0,
    @Column(name = "lrclib_id")
    val lrclibId: Long? = null,
    @Column(name = "vocadb_id")
    val vocadbId: Long? = null,
    @Column(name = "created_at")
    val createdAt: Instant = Instant.now(),
    @Column(name = "updated_at")
    var updatedAt: Instant = Instant.now()
)
