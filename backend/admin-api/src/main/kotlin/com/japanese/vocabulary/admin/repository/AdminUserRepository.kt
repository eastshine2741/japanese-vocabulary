package com.japanese.vocabulary.admin.repository

import com.japanese.vocabulary.user.entity.UserEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository

interface AdminUserRepository : JpaRepository<UserEntity, Long> {
    fun findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrNameContainingIgnoreCase(
        username: String,
        email: String,
        name: String,
        pageable: Pageable,
    ): Page<UserEntity>
}
