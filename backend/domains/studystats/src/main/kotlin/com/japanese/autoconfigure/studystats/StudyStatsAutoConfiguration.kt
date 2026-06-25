package com.japanese.autoconfigure.studystats

import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import com.japanese.vocabulary.studystats.event.StudyStatsEventListener
import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import com.japanese.vocabulary.studystats.service.StreakCalculator
import com.japanese.vocabulary.studystats.service.StudyStatsService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Import
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EntityScan(basePackageClasses = [DailyStudySummaryEntity::class])
@EnableJpaRepositories(basePackageClasses = [DailyStudySummaryRepository::class])
@Import(StudyStatsService::class, StreakCalculator::class, StudyStatsEventListener::class)
class StudyStatsAutoConfiguration
