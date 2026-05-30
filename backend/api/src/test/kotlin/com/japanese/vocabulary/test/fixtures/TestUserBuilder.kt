package com.japanese.vocabulary.test.fixtures

import com.japanese.vocabulary.user.entity.UserEntity
import jakarta.persistence.EntityManager
import java.util.concurrent.atomic.AtomicLong

class TestUserBuilder(private val em: EntityManager) {
    private val seq = SEQ.incrementAndGet()
    private var provider: String = "google"
    private var providerSub: String = "sub-$seq"
    private var username: String = "user$seq"
    private var email: String? = null
    private var name: String? = null

    fun withProvider(value: String) = apply { provider = value }
    fun withProviderSub(value: String) = apply { providerSub = value }
    fun withUsername(value: String) = apply { username = value }
    fun withEmail(value: String?) = apply { email = value }
    fun withName(value: String?) = apply { name = value }

    fun build(): UserEntity = UserEntity(
        provider = provider,
        providerSub = providerSub,
        username = username,
        email = email,
        name = name,
    ).also {
        em.persist(it)
        em.flush()
    }

    companion object {
        private val SEQ = AtomicLong(0)
    }
}
