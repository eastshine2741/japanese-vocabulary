package com.japanese.autoconfigure.deck

import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckFlashcardEntity
import com.japanese.vocabulary.deck.repository.DeckFlashcardRepository
import com.japanese.vocabulary.deck.repository.DeckRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.deck"])
@EntityScan(basePackageClasses = [DeckEntity::class, DeckFlashcardEntity::class])
@EnableJpaRepositories(basePackageClasses = [DeckRepository::class, DeckFlashcardRepository::class])
class DeckAutoConfiguration
