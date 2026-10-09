package com.japanese.vocabulary.notification

import com.japanese.vocabulary.batch.CronTask
import com.japanese.vocabulary.notification.StreakReminderMessage.Slot
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import com.japanese.vocabulary.studystats.service.StreakCalculator
import com.japanese.vocabulary.studystats.util.KstClock
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

/**
 * 연속 학습 알림 (docs/product-intents/260918-streak-commitment.md C). 20:00 / 23:00 KST에
 * 오늘 아직 학습하지 않은 유저에게 연속 학습 상태를 보낸다. "누구에게 / 언제 / 무슨 문구"는 전부
 * 여기서 정하고, notification 모듈은 토큰·제목·본문·data 만 받는다.
 *
 * 공통 대상:
 *  - 기기 토큰이 있다
 *  - 학습 이력이 있다 (daily_study_summary 행 1개 이상). 한 번도 안 한 유저는 대상이 아니다.
 *  - 발송 시점 오늘(KST 04:00 경계) 리뷰가 없다
 *
 * 슬롯별 문구와 끊긴 유저 규칙은 [StreakReminderMessage.compose].
 */
@Component
@ConditionalOnProperty(name = ["push.firebase.enabled"], havingValue = "true")
class StreakReminderTask(
    private val pushNotificationService: PushNotificationService,
    private val deviceTokenRepository: DeviceTokenRepository,
    private val dailyStudySummaryRepository: DailyStudySummaryRepository,
    private val streakCalculator: StreakCalculator,
    private val kstClock: KstClock,
) : CronTask {
    private val logger = LoggerFactory.getLogger(StreakReminderTask::class.java)

    override val name = NAME

    data class Result(val sent: Int, val failed: Int)

    /** `--slot=EVENING` 은 20:00, `--slot=NIGHT` 은 23:00 CronJob 이 넘긴다. */
    override fun run(args: ApplicationArguments) {
        val raw = args.getOptionValues(SLOT_OPTION)?.firstOrNull()
            ?: throw IllegalArgumentException("--$SLOT_OPTION=${Slot.entries.joinToString("|")} is required")
        val slot = Slot.valueOf(raw.uppercase())
        val result = dispatch(slot)
        logger.info("streakReminder {} run result={}", slot, result)
    }

    fun dispatch(slot: Slot, today: LocalDate = kstClock.todayStudyDate()): Result {
        val candidates = findCandidates(slot, today)
        // 23:00 알림(NIGHT는 연속이 살아 있는 유저만 받는다)에만 오늘 학습일이 끝나는 시각을 싣는다.
        // 새 클라는 이걸로 카운트다운을 띄우고, 구버전 클라는 모르는 키라 무시한다.
        // Android 에서 앱이 직접 그려야 하므로 data-only 로 보낸다.
        val timer = slot == Slot.NIGHT
        val expiresAt = kstClock.endOf(today).toEpochMilli().toString()
        var sent = 0
        var failed = 0
        for (c in candidates) {
            val data = buildMap {
                put("type", "streak_reminder")
                put("title", c.message.title)
                put("body", c.message.body)
                if (timer) put("expiresAt", expiresAt)
            }
            val ok = pushNotificationService.send(
                c.userId, c.token, c.message.title, c.message.body, data, androidDataOnly = timer,
            )
            if (ok) sent++ else failed++
        }
        logger.info(
            "streakReminder dispatch slot={} today={} candidates={} sent={} failed={}",
            slot, today, candidates.size, sent, failed,
        )
        return Result(sent, failed)
    }

    @Transactional(readOnly = true)
    fun findCandidates(slot: Slot, today: LocalDate): List<StreakReminderCandidate> {
        val tokensByUserId = deviceTokenRepository.findAll().groupBy { it.userId }
        if (tokensByUserId.isEmpty()) return emptyList()

        val out = mutableListOf<StreakReminderCandidate>()
        for ((userId, tokens) in tokensByUserId) {
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

    companion object {
        const val NAME = "streak-reminder"
        const val SLOT_OPTION = "slot"
    }
}

data class StreakReminderCandidate(
    val userId: Long,
    val token: String,
    val message: StreakReminderMessage,
)
