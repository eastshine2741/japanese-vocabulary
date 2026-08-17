package com.japanese.autoconfigure.word

import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckWordEntity
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.deck.repository.DeckWordRepository
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.repository.WordRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

/**
 * word 도메인의 Spring surface. flashcard 와 deck 은 word 의 부수 개념이라 같은 모듈에 있고,
 * 수명주기가 한 트랜잭션 안에서 맞물리므로 wiring 도 하나로 묶는다.
 */
@AutoConfiguration
@ComponentScan(
    basePackages = [
        "com.japanese.vocabulary.word",
        "com.japanese.vocabulary.flashcard",
        "com.japanese.vocabulary.deck",
    ],
)
@EntityScan(
    basePackageClasses = [
        WordEntity::class,
        FlashcardEntity::class,
        DeckEntity::class,
        DeckWordEntity::class,
    ],
)
@EnableJpaRepositories(
    basePackageClasses = [
        WordRepository::class,
        FlashcardRepository::class,
        DeckRepository::class,
        DeckWordRepository::class,
    ],
)
class WordAutoConfiguration
