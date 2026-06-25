package com.japanese.autoconfigure.studystats

import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.studystats"])
@EntityScan(basePackageClasses = [DailyStudySummaryEntity::class])
@EnableJpaRepositories(basePackageClasses = [DailyStudySummaryRepository::class])
class StudyStatsAutoConfiguration
