package com.japanese.vocabulary.batch

import com.japanese.vocabulary.config.ClockConfig
import com.japanese.vocabulary.config.SentryConfig
import com.japanese.vocabulary.notification.StreakReminderTask
import com.japanese.vocabulary.recommendation.batch.AppleMusicRecommendationCollector
import com.japanese.vocabulary.recommendation.batch.AppleMusicRecommendationJobConfig
import com.japanese.vocabulary.recommendation.batch.AppleMusicRecommendationTask
import com.japanese.vocabulary.recommendation.batch.RecommendationWeekCalculator
import com.japanese.vocabulary.song.batch.LyricWordCandidateBackfillService
import com.japanese.vocabulary.song.batch.LyricWordCandidateBackfillTask
import com.japanese.vocabulary.studystats.batch.FreezeConsumeJobConfig
import com.japanese.vocabulary.studystats.batch.FreezeConsumeService
import com.japanese.vocabulary.studystats.batch.FreezeConsumeTask
import com.japanese.vocabulary.studystats.util.KstClock
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import

/**
 * `http.client.requests` 태깅([com.japanese.vocabulary.observability.HttpClientMetricsConfig])은
 * 싣지 않는다. batch 는 actuator 없이 몇 분 살다 끝나는 CronJob 이라 스크레이프 대상이 아니고,
 * 그 설정은 WebClient 타입 때문에 spring-webflux 를 요구한다.
 */
@Configuration
@Import(
    ClockConfig::class,
    SentryConfig::class,
    CronTaskRunner::class,
    StreakReminderTask::class,
    AppleMusicRecommendationCollector::class,
    AppleMusicRecommendationJobConfig::class,
    AppleMusicRecommendationTask::class,
    RecommendationWeekCalculator::class,
    LyricWordCandidateBackfillService::class,
    LyricWordCandidateBackfillTask::class,
    FreezeConsumeJobConfig::class,
    FreezeConsumeService::class,
    FreezeConsumeTask::class,
    KstClock::class,
)
class BatchLocalConfiguration
