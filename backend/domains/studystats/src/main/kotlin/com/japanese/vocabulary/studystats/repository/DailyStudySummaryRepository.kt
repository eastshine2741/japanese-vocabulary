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

    /**
     * 행 존재로 연속 구간(island)을 잡고, 구간 길이는 freeze 가 아닌 날만 센다.
     * freeze 행은 구간을 잇기만 하고 길이에 들어가지 않는다.
     */
    @Query(
        value = "SELECT COALESCE(MAX(run_len), 0) FROM (" +
            "  SELECT CAST(SUM(freeze_used = FALSE) AS SIGNED) AS run_len FROM (" +
            "    SELECT freeze_used, DATEDIFF(date_kst, '1970-01-01') " +
            "      - ROW_NUMBER() OVER (ORDER BY date_kst) AS island_id " +
            "    FROM daily_study_summary WHERE user_id = :userId" +
            "  ) t GROUP BY island_id" +
            ") g",
        nativeQuery = true,
    )
    fun longestStreak(@Param("userId") userId: Long): Long
}
