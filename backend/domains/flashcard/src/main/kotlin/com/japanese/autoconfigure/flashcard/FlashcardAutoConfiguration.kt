package com.japanese.autoconfigure.flashcard

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.flashcard.service.FlashcardService
import com.japanese.vocabulary.word.entity.SongWordEntity
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import com.japanese.vocabulary.word.service.WordService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Import
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EntityScan(basePackageClasses = [FlashcardEntity::class, WordEntity::class, SongWordEntity::class])
@EnableJpaRepositories(
    basePackageClasses = [
        FlashcardRepository::class,
        WordRepository::class,
        SongWordRepository::class,
    ],
)
@Import(FlashcardService::class, WordService::class)
class FlashcardAutoConfiguration
