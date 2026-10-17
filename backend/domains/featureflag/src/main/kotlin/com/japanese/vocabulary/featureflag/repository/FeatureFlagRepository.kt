package com.japanese.vocabulary.featureflag.repository

import com.japanese.vocabulary.featureflag.entity.FeatureFlagEntity
import org.springframework.data.jpa.repository.JpaRepository

interface FeatureFlagRepository : JpaRepository<FeatureFlagEntity, String>
