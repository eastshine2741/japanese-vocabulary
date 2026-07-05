package com.japanese.vocabulary.api

import com.japanese.vocabulary.auth.controller.AuthController
import com.japanese.vocabulary.common.exception.GlobalExceptionHandler
import com.japanese.vocabulary.config.ClockConfig
import com.japanese.vocabulary.config.RequestLoggingFilter
import com.japanese.vocabulary.config.SecurityConfig
import com.japanese.vocabulary.config.SentryConfig
import com.japanese.vocabulary.deck.controller.DeckController
import com.japanese.vocabulary.flashcard.controller.FlashcardController
import com.japanese.vocabulary.notification.controller.DeviceTokenController
import com.japanese.vocabulary.observability.HttpClientMetricsConfig
import com.japanese.vocabulary.api.recommendation.service.SongRecommendationHomeService
import com.japanese.vocabulary.recommendation.controller.SongRecommendationController
import com.japanese.vocabulary.song.cache.SongSearchCache
import com.japanese.vocabulary.song.controller.SearchHistoryController
import com.japanese.vocabulary.song.controller.SongController
import com.japanese.vocabulary.song.service.RecentSongService
import com.japanese.vocabulary.song.service.SearchHistoryService
import com.japanese.vocabulary.song.service.SongSearchService
import com.japanese.vocabulary.song.service.SongStudyViewService
import com.japanese.vocabulary.song.service.songdetail.SongDetailQueryService
import com.japanese.vocabulary.studystats.controller.StudyStatsController
import com.japanese.vocabulary.studystats.util.KstClock
import com.japanese.vocabulary.user.controller.SettingsController
import com.japanese.vocabulary.user.controller.UserProfileController
import com.japanese.vocabulary.word.controller.WordController
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import

@Configuration
@Import(
    ClockConfig::class,
    HttpClientMetricsConfig::class,
    RequestLoggingFilter::class,
    SecurityConfig::class,
    SentryConfig::class,
    GlobalExceptionHandler::class,
    AuthController::class,
    DeckController::class,
    FlashcardController::class,
    DeviceTokenController::class,
    SongRecommendationController::class,
    SongRecommendationHomeService::class,
    SearchHistoryController::class,
    SongController::class,
    SongSearchCache::class,
    RecentSongService::class,
    SearchHistoryService::class,
    SongSearchService::class,
    SongStudyViewService::class,
    SongDetailQueryService::class,
    StudyStatsController::class,
    KstClock::class,
    SettingsController::class,
    UserProfileController::class,
    WordController::class,
)
class ApiLocalConfiguration
