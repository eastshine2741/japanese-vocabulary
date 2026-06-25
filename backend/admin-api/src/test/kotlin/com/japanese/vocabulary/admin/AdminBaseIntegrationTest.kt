package com.japanese.vocabulary.admin

import com.japanese.vocabulary.test.TestcontainersConfig
import com.japanese.vocabulary.test.clock.MutableClock
import com.japanese.vocabulary.test.clock.TestClockConfig
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Import
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.event.RecordApplicationEvents
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@RecordApplicationEvents
@Import(TestcontainersConfig::class, TestClockConfig::class)
abstract class AdminBaseIntegrationTest {
    @Autowired protected lateinit var entityManager: EntityManager
    @Autowired protected lateinit var clock: MutableClock
    @Autowired protected lateinit var applicationContext: ApplicationContext

    @BeforeEach
    fun resetClock() {
        clock.setTo(TestClockConfig.DEFAULT_FIXED_INSTANT)
    }
}
