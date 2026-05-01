package com.japanese.vocabulary.test.fixtures

import com.japanese.vocabulary.user.entity.UserEntity
import jakarta.persistence.EntityManager
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.transaction.support.TransactionTemplate

class TestUserBuilder(
    private val em: EntityManager,
    private val tx: TransactionTemplate,
) {
    private var name: String = "user-${System.nanoTime()}"
    private var rawPassword: String = "password123"

    fun withName(value: String) = apply { name = value }
    fun withPassword(value: String) = apply { rawPassword = value }

    fun build(): UserEntity = tx.execute {
        val hashed = ENCODER.encode(rawPassword)
        UserEntity(name = name, password = hashed).also {
            em.persist(it)
            em.flush()
        }
    }!!

    companion object {
        private val ENCODER = BCryptPasswordEncoder()
    }
}
