package com.japanese.vocabulary.user.repository

import com.japanese.vocabulary.user.entity.DeviceTokenEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

@Repository
interface DeviceTokenRepository : JpaRepository<DeviceTokenEntity, Long> {
    fun findByToken(token: String): DeviceTokenEntity?

    @Modifying
    @Transactional
    fun deleteByToken(token: String): Int

    fun findAllByUserId(userId: Long): List<DeviceTokenEntity>

    fun countByUserId(userId: Long): Long

    /**
     * Single-statement upsert keyed on the unique `token` column.
     * Prevents SELECT-then-UPDATE races when the same device token migrates between users
     * (e.g. user A logs out, user B logs in on the same device).
     */
    @Modifying
    @Transactional
    @Query(
        value = """
            INSERT INTO device_tokens (user_id, token, platform)
            VALUES (:userId, :token, :platform)
            ON DUPLICATE KEY UPDATE
                user_id = VALUES(user_id),
                platform = VALUES(platform),
                updated_at = CURRENT_TIMESTAMP(6)
        """,
        nativeQuery = true,
    )
    fun upsert(
        @Param("userId") userId: Long,
        @Param("token") token: String,
        @Param("platform") platform: String,
    ): Int
}
