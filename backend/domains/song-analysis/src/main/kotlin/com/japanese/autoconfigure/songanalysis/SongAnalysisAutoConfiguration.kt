package com.japanese.autoconfigure.songanalysis

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Import
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EntityScan(basePackageClasses = [SongAnalysisWorkEntity::class])
@EnableJpaRepositories(basePackageClasses = [SongAnalysisWorkRepository::class])
@Import(SongAnalysisWorkService::class)
class SongAnalysisAutoConfiguration
