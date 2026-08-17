package com.japanese.autoconfigure.deck

import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckWordEntity
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.deck.repository.DeckWordRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.deck"])
@EntityScan(basePackageClasses = [DeckEntity::class, DeckWordEntity::class])
@EnableJpaRepositories(basePackageClasses = [DeckRepository::class, DeckWordRepository::class])
class DeckAutoConfiguration
