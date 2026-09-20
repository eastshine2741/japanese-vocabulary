package com.japanese.vocabulary.notification

import com.japanese.vocabulary.notification.StreakReminderMessage.Slot
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import com.japanese.vocabulary.studystats.service.StreakCalculator
import com.japanese.vocabulary.studystats.util.KstClock
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

/**
 * 연속 학습 알림 (docs/product-intents/260918-streak-commitment.md C). 20:00 / 23:00 KST에
 * 오늘 아직 학습하지 않은 유저에게 연속 학습 상태를 보낸다. "누구에게 / 언제 / 무슨 문구"는 전부
 * 여기서 정하고, notification 모듈은 토큰·제목·본문·data 만 받는다.
 *
 * 공통 대상:
 *  - 기기 토큰이 있고 notificationsEnabled (설정 행이 없으면 켜진 것으로 본다)
 *  - 학습 이력이 있다 (daily_study_summary 행 1개 이상). 한 번도 안 한 유저는 대상이 아니다.
 *  - 발송 시점 오늘(KST 04:00 경계) 리뷰가 없다
 *
 * 슬롯별 문구와 끊긴 유저 규칙은 [StreakReminderMessage.compose].
 */
@Component
@ConditionalOnProperty(name = ["push.firebase.enabled"], havingValue = "true")
class StreakReminderScheduler(
    private val pushNotificationService: PushNotificationService,
    private val deviceTokenRepository: DeviceTokenRepository,
    private val userSettingsRepository: UserSettingsRepository,
    private val dailyStudySummaryRepository: DailyStudySummaryRepository,
    private val streakCalculator: StreakCalculator,
    private val kstClock: KstClock,
) {
    private val logger = LoggerFactory.getLogger(StreakReminderScheduler::class.java)

    data class Result(val sent: Int, val failed: Int)

    @Scheduled(cron = "0 0 20 * * *", zone = "Asia/Seoul")
    fun runEvening() = run(Slot.EVENING)

    @Scheduled(cron = "0 0 23 * * *", zone = "Asia/Seoul")
    fun runNight() = run(Slot.NIGHT)

    fun dispatch(slot: Slot, today: LocalDate = kstClock.todayStudyDate()): Result {
        val candidates = findCandidates(slot, today)
        var sent = 0
        var failed = 0
        for (c in candidates) {
            val data = mapOf(
                "type" to "streak_reminder",
                "title" to c.message.title,
                "body" to c.message.body,
            )
            if (pushNotificationService.send(c.userId, c.token, c.message.title, c.message.body, data)) sent++ else failed++
        }
        logger.info(
            "streakReminder dispatch slot={} today={} candidates={} sent={} failed={}",
            slot, today, candidates.size, sent, failed,
        )
        return Result(sent, failed)
    }

    private fun run(slot: Slot) {
        try {
            val result = dispatch(slot)
            logger.info("streakReminder {} run result={}", slot, result)
        } catch (e: Exception) {
            logger.error("streakReminder {} run failed", slot, e)
        }
    }

    @Transactional(readOnly = true)
    fun findCandidates(slot: Slot, today: LocalDate): List<StreakReminderCandidate> {
        val tokensByUserId = deviceTokenRepository.findAll().groupBy { it.userId }
        if (tokensByUserId.isEmpty()) return emptyList()

        val settingsByUserId = userSettingsRepository.findAll().associateBy { it.userId }

        val out = mutableListOf<StreakReminderCandidate>()
        for ((userId, tokens) in tokensByUserId) {
            val settings = settingsByUserId[userId]
            if (settings != null && !settings.settings.notificationsEnabled) continue

            val lastStudyDate = dailyStudySummaryRepository.findLastDateKst(userId) ?: continue
            val todayRow = dailyStudySummaryRepository.findByUserIdAndDateKst(userId, today)
            if (todayRow != null && todayRow.reviewCount > 0) continue

            val streak = streakCalculator.currentStreak(userId, today)
            val message = StreakReminderMessage.compose(slot, streak, lastStudyDate, today) ?: continue

            for (token in tokens) {
                out += StreakReminderCandidate(userId = userId, token = token.token, message = message)
            }
        }
        return out
    }
}

data class StreakReminderCandidate(
    val userId: Long,
    val token: String,
    val message: StreakReminderMessage,
)
