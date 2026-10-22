package com.japanese.vocabulary.songanalysis.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EntityListeners
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant

/**
 * 한 작업의 한 단계. 산출물([output])은 다음 단계의 입력이고, 실패하면 원인이 여기 남는다.
 * 내용 형식은 worker 가 정한다 — 이 모듈은 JSON 문자열로만 다룬다.
 */
@Entity
@Table(name = "song_analysis_work_stage")
@EntityListeners(AuditingEntityListener::class)
class SongAnalysisWorkStageEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "work_id", nullable = false)
    val workId: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    val stage: SongAnalysisWorkStage,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: SongAnalysisStageStatus = SongAnalysisStageStatus.PENDING,

    @Column(nullable = false)
    var attempt: Int = 0,

    @Column(columnDefinition = "MEDIUMTEXT")
    var output: String? = null,

    @Column(name = "error_code")
    var errorCode: String? = null,

    @Column(name = "error_class")
    var errorClass: String? = null,

    @Column(name = "error_message", columnDefinition = "TEXT")
    var errorMessage: String? = null,

    @Column(name = "started_at")
    var startedAt: Instant? = null,

    @Column(name = "finished_at")
    var finishedAt: Instant? = null,

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
) {
    fun start(now: Instant) {
        status = SongAnalysisStageStatus.RUNNING
        attempt += 1
        startedAt = now
        finishedAt = null
        errorCode = null
        errorClass = null
        errorMessage = null
    }

    fun complete(output: String?, now: Instant) {
        status = SongAnalysisStageStatus.COMPLETED
        this.output = output
        finishedAt = now
    }

    fun fail(failure: SongAnalysisStageFailure, now: Instant) {
        status = SongAnalysisStageStatus.FAILED
        errorCode = failure.code
        errorClass = failure.errorClass?.take(MAX_ERROR_CLASS_LENGTH)
        errorMessage = failure.detail?.take(MAX_ERROR_MESSAGE_LENGTH)
        finishedAt = now
    }

    companion object {
        const val MAX_ERROR_CLASS_LENGTH = 255
        const val MAX_ERROR_MESSAGE_LENGTH = 4000
    }
}

/**
 * 단계 실패의 기록. [code] 는 유저에게도 보이는 원장의 error_code 가 되고, [errorClass] 와
 * [detail] 은 운영자용으로 단계 행에만 남는다.
 */
data class SongAnalysisStageFailure(
    val code: String,
    val userMessage: String?,
    val errorClass: String?,
    val detail: String?,
)
