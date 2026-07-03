package com.japanese.vocabulary.batch

import com.japanese.vocabulary.config.ClockConfig
import com.japanese.vocabulary.config.SentryConfig
import com.japanese.vocabulary.notification.ReviewReminderDevController
import com.japanese.vocabulary.notification.ReviewReminderScheduler
import com.japanese.vocabulary.observability.HttpClientMetricsConfig
import com.japanese.vocabulary.recommendation.batch.AppleMusicRecommendationCollector
import com.japanese.vocabulary.recommendation.batch.RecommendationWeekCalculator
import com.japanese.vocabulary.song.batch.SongAnalysisWorkCompletionService
import com.japanese.vocabulary.song.batch.SongAnalysisWorkProcessor
import com.japanese.vocabulary.song.batch.SongAnalysisWorkScheduler
import com.japanese.vocabulary.song.cache.ArtistChannelCache
import com.japanese.vocabulary.song.service.SongAnalysisPreparationService
import com.japanese.vocabulary.song.service.YoutubeMvSearchService
import com.japanese.vocabulary.studystats.batch.FreezeConsumeDevController
import com.japanese.vocabulary.studystats.batch.FreezeConsumeJobConfig
import com.japanese.vocabulary.studystats.batch.FreezeConsumeScheduler
import com.japanese.vocabulary.studystats.batch.FreezeConsumeService
import com.japanese.vocabulary.studystats.util.KstClock
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import

@Configuration
@Import(
    ClockConfig::class,
    HttpClientMetricsConfig::class,
    SentryConfig::class,
    ReviewReminderDevController::class,
    ReviewReminderScheduler::class,
    AppleMusicRecommendationCollector::class,
    RecommendationWeekCalculator::class,
    SongAnalysisWorkCompletionService::class,
    SongAnalysisWorkProcessor::class,
    SongAnalysisWorkScheduler::class,
    ArtistChannelCache::class,
    SongAnalysisPreparationService::class,
    YoutubeMvSearchService::class,
    FreezeConsumeDevController::class,
    FreezeConsumeJobConfig::class,
    FreezeConsumeScheduler::class,
    FreezeConsumeService::class,
    KstClock::class,
)
class BatchLocalConfiguration
