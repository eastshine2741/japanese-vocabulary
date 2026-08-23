package com.japanese.autoconfigure.recommendation

import com.japanese.vocabulary.recommendation.entity.SongRecommendationCandidateEntity
import com.japanese.vocabulary.recommendation.entity.SongRecommendationEntity
import com.japanese.vocabulary.recommendation.repository.SongRecommendationCandidateRepository
import com.japanese.vocabulary.recommendation.repository.SongRecommendationRepository
import com.japanese.vocabulary.recommendation.service.SongRecommendationService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackageClasses = [SongRecommendationService::class])
@EntityScan(basePackageClasses = [SongRecommendationCandidateEntity::class, SongRecommendationEntity::class])
@EnableJpaRepositories(basePackageClasses = [SongRecommendationCandidateRepository::class, SongRecommendationRepository::class])
class RecommendationAutoConfiguration
