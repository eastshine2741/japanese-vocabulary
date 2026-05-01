package com.japanese.vocabulary.user.repository

import com.japanese.vocabulary.user.entity.UserEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface UserRepository : JpaRepository<UserEntity, Long> {
    fun findByProviderAndProviderSub(provider: String, providerSub: String): UserEntity?
}
