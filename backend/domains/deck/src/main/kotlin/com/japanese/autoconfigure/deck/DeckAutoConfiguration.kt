package com.japanese.autoconfigure.deck

import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckFlashcardEntity
import com.japanese.vocabulary.deck.event.DeckEventListener
import com.japanese.vocabulary.deck.repository.DeckFlashcardRepository
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.deck.service.DeckService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Import
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EntityScan(basePackageClasses = [DeckEntity::class, DeckFlashcardEntity::class])
@EnableJpaRepositories(basePackageClasses = [DeckRepository::class, DeckFlashcardRepository::class])
@Import(DeckService::class, DeckEventListener::class)
class DeckAutoConfiguration
