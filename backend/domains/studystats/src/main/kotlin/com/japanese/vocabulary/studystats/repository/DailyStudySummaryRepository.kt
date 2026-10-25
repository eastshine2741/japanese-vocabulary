package com.japanese.vocabulary.studystats.repository

import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDate

interface DailyStudySummaryRepository : JpaRepository<DailyStudySummaryEntity, Long> {

    fun findByUserIdAndDateKst(userId: Long, dateKst: LocalDate): DailyStudySummaryEntity?

    fun existsByUserIdAndDateKstLessThan(userId: Long, dateKst: LocalDate): Boolean

    /** 마지막으로 실제 복습한 날. freeze 로만 채워진 날은 제외. */
    @Query("SELECT MAX(d.dateKst) FROM DailyStudySummaryEntity d WHERE d.userId = :userId AND d.freezeUsed = false")
    fun findLastDateKst(@Param("userId") userId: Long): LocalDate?

    fun findByUserIdAndDateKstBetweenOrderByDateKstAsc(
        userId: Long,
        from: LocalDate,
        to: LocalDate,
    ): List<DailyStudySummaryEntity>

    @Modifying
    @Query(
        value = "INSERT INTO daily_study_summary (user_id, date_kst, review_count, freeze_used) " +
            "VALUES (:userId, :dateKst, 1, FALSE) " +
            "ON DUPLICATE KEY UPDATE review_count = review_count + 1",
        nativeQuery = true,
    )
    fun upsertIncrement(@Param("userId") userId: Long, @Param("dateKst") dateKst: LocalDate): Int

    /** 실제 복습한 날 수. freeze 로만 채워진 날은 제외. */
    @Query("SELECT COUNT(d) FROM DailyStudySummaryEntity d WHERE d.userId = :userId AND d.freezeUsed = false")
    fun countStudyDays(@Param("userId") userId: Long): Long

    fun findByUserIdAndDateKstLessThanEqualOrderByDateKstDesc(
        userId: Long,
        today: LocalDate,
        pageable: Pageable,
    ): List<DailyStudySummaryEntity>

    /** 엔티티가 아니라 DTO 라 OSIV 로 열린 영속성 컨텍스트에 쌓이지 않는다. */
    @Query(
        "SELECT new com.japanese.vocabulary.studystats.repository.StudyDay(d.dateKst, d.freezeUsed) " +
            "FROM DailyStudySummaryEntity d WHERE d.userId = :userId AND d.dateKst < :before ORDER BY d.dateKst DESC"
    )
    fun findStudyDaysBefore(
        @Param("userId") userId: Long,
        @Param("before") before: LocalDate,
        pageable: Pageable,
    ): List<StudyDay>
}

data class StudyDay(val dateKst: LocalDate, val freezeUsed: Boolean)
