package com.japanese.vocabulary.notification

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.sql.Timestamp
import java.time.Duration
import java.time.Instant

/**
 * Result of [PushNotificationDataAccess.findCandidates] — one row per user eligible for a push
 * reminder at the requested timestamp. `flashcardId` references the oldest-due card so the
 * deep-link can drop the user straight onto that card in `ReviewScreen`.
 */
data class NotificationCandidate(
    val userId: Long,
    val token: String,
    val platform: String,
    val flashcardId: Long,
    val wordSurface: String,
)

/**
 * JDBC raw-SQL access for the push notification batch. Keeps the batch module independent of api
 * JPA entities (see `settings.gradle.kts`: batch → common only). Mirrors the
 * `FreezeConsumeService` pattern of one-class-per-domain plus raw SQL.
 *
 * Transaction policy (from plan AC-BATCH-7): writes are wrapped in `REQUIRES_NEW` so external
 * I/O (FCM `send`) never sits inside an open DB transaction. `findCandidates` runs read-only.
 */
@Repository
class PushNotificationDataAccess(private val jdbcTemplate: JdbcTemplate) {

    private val candidateRowMapper = RowMapper { rs, _ ->
        NotificationCandidate(
            userId = rs.getLong("user_id"),
            token = rs.getString("token"),
            platform = rs.getString("platform"),
            flashcardId = rs.getLong("flashcard_id"),
            wordSurface = rs.getString("word_surface"),
        )
    }

    /**
     * One SQL pass per run. The CTE picks the oldest-due flashcard per user via ROW_NUMBER.
     * JSON_EXTRACT against `user_settings` uses [NOTIFICATIONS_ENABLED_KEY] (mirror of the api
     * source-of-truth) so a key drift between modules surfaces in
     * `PushNotificationDataAccessIntegrationTest`.
     *
     * `due` is bounded to the past [LOOKBACK_WINDOW] window so cards that have been ignored for
     * weeks don't keep generating notifications (and so the SQL hits `idx_flashcards_due` as a
     * proper range scan rather than scanning the whole table).
     *
     * Note on schema: the `words` table column is `japanese_text` (not `surface`); we alias it to
     * `word_surface` so the DTO contract reads as in the plan.
     */
    @Transactional(readOnly = true)
    fun findCandidates(now: Instant): List<NotificationCandidate> {
        val since = now.minus(LOOKBACK_WINDOW)
        val sql = """
            WITH due AS (
                SELECT f.user_id,
                       f.id AS flashcard_id,
                       f.word_id,
                       ROW_NUMBER() OVER (PARTITION BY f.user_id ORDER BY f.due ASC) AS rn
                FROM flashcards f
                WHERE f.due >= ? AND f.due <= ?
            )
            SELECT t.user_id,
                   t.token,
                   t.platform,
                   d.flashcard_id,
                   w.japanese_text AS word_surface
            FROM device_tokens t
            JOIN due d  ON d.user_id = t.user_id AND d.rn = 1
            JOIN words w ON w.id = d.word_id
            LEFT JOIN user_settings us ON us.user_id = t.user_id
            WHERE COALESCE(JSON_EXTRACT(us.settings, '$.${NOTIFICATIONS_ENABLED_KEY}'), TRUE) = TRUE
        """.trimIndent()
        return jdbcTemplate.query(sql, candidateRowMapper, Timestamp.from(since), Timestamp.from(now))
    }

    /**
     * Records a successful FCM send. Failures are not persisted — see
     * [PushNotificationService] for the logger-only failure path.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun recordLog(
        userId: Long,
        sentAt: Instant,
        title: String,
        body: String,
    ) {
        jdbcTemplate.update(
            """
            INSERT INTO notification_logs (user_id, sent_at, title, body)
            VALUES (?, ?, ?, ?)
            """.trimIndent(),
            userId,
            Timestamp.from(sentAt),
            title.take(MAX_TITLE_LEN),
            body.take(MAX_BODY_LEN),
        )
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun deleteInvalidToken(token: String) {
        jdbcTemplate.update("DELETE FROM device_tokens WHERE token = ?", token)
    }

    private companion object {
        const val MAX_TITLE_LEN = 255
        const val MAX_BODY_LEN = 512
        val LOOKBACK_WINDOW: Duration = Duration.ofDays(7)
    }
}
