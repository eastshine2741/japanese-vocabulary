package com.japanese.vocabulary.user.repository

import com.japanese.vocabulary.user.entity.UserEntity
import org.springframework.data.jpa.repository.JpaRepository

interface UserRepository : JpaRepository<UserEntity, Long> {
    fun findByProviderAndProviderSub(provider: String, providerSub: String): UserEntity?
    fun findByUsername(username: String): UserEntity?
    fun findByIdAndDeletedAtIsNull(id: Long): UserEntity?
}
