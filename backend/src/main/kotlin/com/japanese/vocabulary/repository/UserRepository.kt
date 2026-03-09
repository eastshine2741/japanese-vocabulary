package com.japanese.vocabulary.repository

import com.japanese.vocabulary.entity.UserEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface UserRepository : JpaRepository<UserEntity, Long> {
    fun findByName(name: String): UserEntity?
}
