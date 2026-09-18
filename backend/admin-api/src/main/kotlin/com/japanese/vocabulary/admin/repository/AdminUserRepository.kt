package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.user.entity.UserEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDate

interface AdminUserRepository : JpaRepository<UserEntity, Long> {
    fun findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrNameContainingIgnoreCase(
        username: String,
        email: String,
        name: String,
        pageable: Pageable,
    ): Page<UserEntity>

    // daily_study_summary 는 studystats 모듈 소유지만 admin 은 읽기 집계만 필요해서
    // 모듈(과 그 뒤의 userinventory/KstClock 배선)을 끌어오지 않고 테이블을 직접 읽는다.
    @Query(
        nativeQuery = true,
        value = """
            SELECT COUNT(*) AS reviewDays, COALESCE(SUM(review_count), 0) AS reviewCount
            FROM daily_study_summary
            WHERE user_id = :userId AND date_kst >= :since AND review_count > 0
        """,
    )
    fun summarizeRecentStudy(@Param("userId") userId: Long, @Param("since") since: LocalDate): AdminRecentStudyProjection
}

interface AdminRecentStudyProjection {
    fun getReviewDays(): Long
    fun getReviewCount(): Long
}
