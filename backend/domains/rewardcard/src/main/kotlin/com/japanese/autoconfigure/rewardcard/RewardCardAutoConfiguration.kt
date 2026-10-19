package com.japanese.autoconfigure.rewardcard

import com.japanese.vocabulary.rewardcard.entity.SongCardEntity
import com.japanese.vocabulary.rewardcard.repository.SongCardRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.rewardcard"])
@EntityScan(basePackageClasses = [SongCardEntity::class])
@EnableJpaRepositories(basePackageClasses = [SongCardRepository::class])
class RewardCardAutoConfiguration
