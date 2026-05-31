package com.japanese.vocabulary.test

import com.japanese.vocabulary.test.clock.MutableClock
import com.japanese.vocabulary.test.clock.TestClockConfig
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.event.RecordApplicationEvents
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@RecordApplicationEvents
@Import(TestcontainersConfig::class, TestClockConfig::class)
abstract class BaseIntegrationTest {

    @Autowired
    protected lateinit var entityManager: EntityManager

    @Autowired
    protected lateinit var clock: MutableClock

    @Autowired
    protected lateinit var redisTemplate: StringRedisTemplate

    @BeforeEach
    fun resetSharedState() {
        clock.setTo(TestClockConfig.DEFAULT_FIXED_INSTANT)
        redisTemplate.connectionFactory?.connection?.use { it.serverCommands().flushDb() }
    }
}
