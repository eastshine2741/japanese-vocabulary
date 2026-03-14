package com.japanese.vocabulary.word.repository

import com.japanese.vocabulary.word.entity.WordEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface WordRepository : JpaRepository<WordEntity, Long> {
    fun findByUserIdOrderByIdDesc(userId: Long, pageable: Pageable): List<WordEntity>
    fun findByUserIdAndIdLessThanOrderByIdDesc(userId: Long, id: Long, pageable: Pageable): List<WordEntity>
    fun findByUserId(userId: Long): List<WordEntity>
    fun findByUserIdAndJapaneseText(userId: Long, japaneseText: String): WordEntity?
}
