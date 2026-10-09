package com.japanese.autoconfigure.recommendation

import com.japanese.vocabulary.recommendation.entity.RecommendedSongEntity
import com.japanese.vocabulary.recommendation.repository.RecommendedSongRepository
import com.japanese.vocabulary.recommendation.service.RecommendedSongService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackageClasses = [RecommendedSongService::class])
@EntityScan(basePackageClasses = [RecommendedSongEntity::class])
@EnableJpaRepositories(basePackageClasses = [RecommendedSongRepository::class])
class RecommendationAutoConfiguration
