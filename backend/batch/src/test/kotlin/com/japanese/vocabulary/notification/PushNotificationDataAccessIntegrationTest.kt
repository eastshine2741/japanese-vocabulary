package com.japanese.vocabulary.notification

import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.support.GeneratedKeyHolder
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.sql.Statement
import java.sql.Timestamp
import java.time.Duration
import java.time.Instant
import java.util.concurrent.atomic.AtomicLong

/**
 * Real-schema verification of [PushNotificationDataAccess.findCandidates]. Hits the same Flyway
 * migrations production runs against (Testcontainers MySQL), which means a drift between
 * `NOTIFICATIONS_ENABLED_KEY` in this module and the api source-of-truth would surface as a
 * miss in the JSON_EXTRACT filter.
 *
 * Fixture note (deviation from AC-TEST-2 plan text): plan suggested funneling user_settings
 * through `UserSettingsService.updateSettings()`. The batch gradle module does NOT depend on
 * api, so `UserSettingsService` is unreachable from this test. Instead the JSON blob is written
 * via `JSON_OBJECT` keyed on [NOTIFICATIONS_ENABLED_KEY], which still exercises the same key
 * the production code uses and validates that the SQL filter agrees with it.
 */
class PushNotificationDataAccessIntegrationTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var dataAccess: PushNotificationDataAccess
    @Autowired private lateinit var jdbcTemplate: JdbcTemplate

    private val now: Instant = Instant.parse("2026-06-01T00:00:00Z")

    @Test
    fun `user with due cards and notificationsEnabled=true is included with oldest flashcardId`() {
        val user = insertUser()
        insertDeviceToken(user, "tok-A", "ANDROID")
        insertSettings(user, notificationsEnabled = true)
        val w1 = insertWord(user, "古い")
        val w2 = insertWord(user, "新しい")
        val w3 = insertWord(user, "中ぐらい")
        val oldest = insertFlashcard(user, w1, due = now.minusSeconds(3600))
        insertFlashcard(user, w2, due = now.minusSeconds(1800))
        insertFlashcard(user, w3, due = now.minusSeconds(60))

        val candidates = dataAccess.findCandidates(now)

        assertThat(candidates).hasSize(1)
        val c = candidates.first()
        assertThat(c.userId).isEqualTo(user)
        assertThat(c.token).isEqualTo("tok-A")
        assertThat(c.platform).isEqualTo("ANDROID")
        assertThat(c.flashcardId).isEqualTo(oldest)
        // wordSurface starts with the requested japanese text (suffixed per-row for uniqueness)
        assertThat(c.wordSurface).startsWith("古い")
    }

    @Test
    fun `card due older than the 7-day lookback window is excluded`() {
        val user = insertUser()
        insertDeviceToken(user, "tok-stale", "ANDROID")
        insertSettings(user, notificationsEnabled = true)
        val word = insertWord(user, "古過ぎる")
        // 8 days ago — outside the (now - 7d, now] window.
        insertFlashcard(user, word, due = now.minus(Duration.ofDays(8)))

        assertThat(dataAccess.findCandidates(now)).isEmpty()
    }

    @Test
    fun `user with zero due cards is excluded`() {
        val user = insertUser()
        insertDeviceToken(user, "tok-future", "ANDROID")
        insertSettings(user, notificationsEnabled = true)
        val word = insertWord(user, "未来")
        insertFlashcard(user, word, due = now.plusSeconds(86400))

        assertThat(dataAccess.findCandidates(now)).isEmpty()
    }

    @Test
    fun `user with notificationsEnabled=false is excluded`() {
        val user = insertUser()
        insertDeviceToken(user, "tok-off", "ANDROID")
        insertSettings(user, notificationsEnabled = false)
        val word = insertWord(user, "無音")
        insertFlashcard(user, word, due = now.minusSeconds(60))

        assertThat(dataAccess.findCandidates(now)).isEmpty()
    }

    @Test
    fun `user with no device_token is excluded`() {
        val user = insertUser()
        insertSettings(user, notificationsEnabled = true)
        val word = insertWord(user, "無端末")
        insertFlashcard(user, word, due = now.minusSeconds(60))

        assertThat(dataAccess.findCandidates(now)).isEmpty()
    }

    @Test
    fun `user with no user_settings row is included by COALESCE default true`() {
        val user = insertUser()
        insertDeviceToken(user, "tok-default", "IOS")
        val word = insertWord(user, "既定")
        val card = insertFlashcard(user, word, due = now.minusSeconds(10))

        val candidates = dataAccess.findCandidates(now)

        assertThat(candidates).hasSize(1)
        assertThat(candidates.first().flashcardId).isEqualTo(card)
    }

    /**
     * Runs outside the surrounding `@Transactional` wrapper of [BatchBaseIntegrationTest] so that
     * `REQUIRES_NEW` writes inside `recordLog` / `deleteInvalidToken` don't deadlock with the
     * outer test transaction holding device_tokens row locks. Manual cleanup via [tearDownIsolated].
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    fun `recordLog inserts row and deleteInvalidToken removes token`() {
        val user = insertUser()
        insertDeviceToken(user, "tok-del", "ANDROID")

        dataAccess.recordLog(
            userId = user,
            sentAt = now,
            title = "紅葉, 이 단어 기억나시나요?",
            body = "잊어버리기 전에 잠깐 들러보세요.",
        )
        dataAccess.deleteInvalidToken("tok-del")

        val logRows = jdbcTemplate.queryForList(
            "SELECT title, body FROM notification_logs WHERE user_id = ?", user,
        )
        assertThat(logRows).hasSize(1)
        assertThat(logRows.first()["title"]).isEqualTo("紅葉, 이 단어 기억나시나요?")
        assertThat(logRows.first()["body"]).isEqualTo("잊어버리기 전에 잠깐 들러보세요.")

        val tokenRows = jdbcTemplate.queryForList(
            "SELECT id FROM device_tokens WHERE token = ?", "tok-del",
        )
        assertThat(tokenRows).isEmpty()

        // Cleanup committed rows from this isolated test (Transactional rollback won't reach them).
        jdbcTemplate.update("DELETE FROM notification_logs WHERE user_id = ?", user)
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", user)
    }

    // --- fixtures -------------------------------------------------------------------------------

    private fun insertUser(): Long {
        val seq = SEQ.incrementAndGet()
        val keyHolder = GeneratedKeyHolder()
        jdbcTemplate.update({ conn ->
            conn.prepareStatement(
                "INSERT INTO users (provider, provider_sub, username) VALUES ('test', ?, ?)",
                Statement.RETURN_GENERATED_KEYS,
            ).apply {
                setString(1, "push-sub-$seq")
                setString(2, "push-user-$seq")
            }
        }, keyHolder)
        return keyHolder.key!!.toLong()
    }

    private fun insertDeviceToken(userId: Long, token: String, platform: String) {
        jdbcTemplate.update(
            "INSERT INTO device_tokens (user_id, token, platform) VALUES (?, ?, ?)",
            userId, token, platform,
        )
    }

    private fun insertSettings(userId: Long, notificationsEnabled: Boolean) {
        // CAST(? AS JSON) parses the JSON literal so the value is stored as a real JSON boolean
        // (matching the api's Jackson-serialized writes). MySQL 8.4 coerces JDBC boolean params
        // bound through `JSON_OBJECT(?, ?)` to integer 1, which would diverge from prod shape.
        jdbcTemplate.update(
            "INSERT INTO user_settings (user_id, settings) VALUES (?, CAST(? AS JSON))",
            userId, """{"$NOTIFICATIONS_ENABLED_KEY":$notificationsEnabled}""",
        )
    }

    private fun insertWord(userId: Long, japaneseText: String): Long {
        val seq = SEQ.incrementAndGet()
        val keyHolder = GeneratedKeyHolder()
        jdbcTemplate.update({ conn ->
            conn.prepareStatement(
                "INSERT INTO words (user_id, japanese_text, reading) VALUES (?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS,
            ).apply {
                setLong(1, userId)
                setString(2, "$japaneseText-$seq")
                setString(3, "")
            }
        }, keyHolder)
        return keyHolder.key!!.toLong()
    }

    private fun insertFlashcard(userId: Long, wordId: Long, due: Instant): Long {
        val keyHolder = GeneratedKeyHolder()
        jdbcTemplate.update({ conn ->
            conn.prepareStatement(
                "INSERT INTO flashcards (word_id, user_id, due, fsrs_card_json) VALUES (?, ?, ?, '{}')",
                Statement.RETURN_GENERATED_KEYS,
            ).apply {
                setLong(1, wordId)
                setLong(2, userId)
                setTimestamp(3, Timestamp.from(due))
            }
        }, keyHolder)
        return keyHolder.key!!.toLong()
    }

    companion object {
        private val SEQ = AtomicLong(0)
    }
}
