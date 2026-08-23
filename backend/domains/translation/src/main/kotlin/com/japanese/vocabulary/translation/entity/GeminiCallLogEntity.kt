package com.japanese.vocabulary.translation.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/**
 * One Gemini call's input payload and raw response, kept only so pipeline output can be traced back
 * to what the model actually saw (which sense candidates a homograph got, which lines a chunk held).
 *
 * TODO: 임시다. Loki 같은 로그 수집 스택이 들어오면 이 엔티티와 `gemini_call_log` 테이블을 지우고
 *  stdout 구조화 로그로 이관한다.
 */
@Entity
@Table(name = "gemini_call_log")
class GeminiCallLogEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "song_id")
    val songId: Long? = null,

    @Column(name = "lyric_id")
    val lyricId: Long? = null,

    @Column(name = "call_name", nullable = false, length = 40)
    val callName: String,

    @Column(nullable = false, length = 80)
    val model: String,

    @Column(name = "request_json", nullable = false, columnDefinition = "MEDIUMTEXT")
    val requestJson: String,

    @Column(name = "response_json", columnDefinition = "MEDIUMTEXT")
    val responseJson: String? = null,

    @Column(name = "error_message", length = 1000)
    val errorMessage: String? = null,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),
)
