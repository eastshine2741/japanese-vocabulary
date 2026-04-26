package com.japanese.vocabulary.studystats.repository

import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.LocalDate

@Repository
interface DailyStudySummaryRepository : JpaRepository<DailyStudySummaryEntity, Long> {

    fun findByUserIdAndDateKst(userId: Long, dateKst: LocalDate): DailyStudySummaryEntity?

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

    @Query("SELECT COUNT(d) FROM DailyStudySummaryEntity d WHERE d.userId = :userId")
    fun countByUserId(@Param("userId") userId: Long): Long

    @Query(
        "SELECT d.dateKst FROM DailyStudySummaryEntity d " +
            "WHERE d.userId = :userId AND d.dateKst <= :today " +
            "ORDER BY d.dateKst DESC"
    )
    fun findRecentDatesDesc(
        @Param("userId") userId: Long,
        @Param("today") today: LocalDate,
        pageable: Pageable,
    ): List<LocalDate>

    @Query(
        value = "SELECT COALESCE(MAX(run_len), 0) FROM (" +
            "  SELECT COUNT(*) AS run_len FROM (" +
            "    SELECT DATEDIFF(date_kst, '1970-01-01') " +
            "      - ROW_NUMBER() OVER (ORDER BY date_kst) AS island_id " +
            "    FROM daily_study_summary WHERE user_id = :userId" +
            "  ) t GROUP BY island_id" +
            ") g",
        nativeQuery = true,
    )
    fun longestStreak(@Param("userId") userId: Long): Long
}
