package com.japanese.vocabulary.worker

import com.japanese.vocabulary.config.ClockConfig
import com.japanese.vocabulary.config.SentryConfig
import com.japanese.vocabulary.notification.AnalysisNotificationDispatcher
import com.japanese.vocabulary.notification.AnalysisNotificationListener
import com.japanese.vocabulary.observability.HttpClientMetricsConfig
import com.japanese.vocabulary.song.cache.ArtistChannelCache
import com.japanese.vocabulary.song.service.SongAnalysisPreparationService
import com.japanese.vocabulary.song.service.YoutubeMvSearchService
import com.japanese.vocabulary.song.worker.SongAnalysisWorkCompletionService
import com.japanese.vocabulary.song.worker.SongAnalysisWorkListener
import com.japanese.vocabulary.song.worker.SongAnalysisWorkProcessor
import com.japanese.vocabulary.song.worker.SongAnalysisWorkSweeper
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import

@Configuration
@Import(
    ClockConfig::class,
    HttpClientMetricsConfig::class,
    SentryConfig::class,
    AnalysisNotificationDispatcher::class,
    AnalysisNotificationListener::class,
    ArtistChannelCache::class,
    SongAnalysisPreparationService::class,
    YoutubeMvSearchService::class,
    SongAnalysisWorkCompletionService::class,
    SongAnalysisWorkListener::class,
    SongAnalysisWorkProcessor::class,
    SongAnalysisWorkSweeper::class,
)
class WorkerLocalConfiguration
