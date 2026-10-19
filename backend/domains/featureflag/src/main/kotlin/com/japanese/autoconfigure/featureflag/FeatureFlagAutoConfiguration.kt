package com.japanese.autoconfigure.featureflag

import com.japanese.vocabulary.featureflag.entity.FeatureFlagEntity
import com.japanese.vocabulary.featureflag.repository.FeatureFlagRepository
import com.japanese.vocabulary.featureflag.service.FeatureFlags
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackageClasses = [FeatureFlags::class])
@EntityScan(basePackageClasses = [FeatureFlagEntity::class])
@EnableJpaRepositories(basePackageClasses = [FeatureFlagRepository::class])
class FeatureFlagAutoConfiguration
