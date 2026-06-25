package com.japanese.autoconfigure.songanalysis

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.songanalysis"])
@EntityScan(basePackageClasses = [SongAnalysisWorkEntity::class])
@EnableJpaRepositories(basePackageClasses = [SongAnalysisWorkRepository::class])
class SongAnalysisAutoConfiguration
