package com.japanese.vocabulary.test

import com.japanese.vocabulary.test.clock.MutableClock
import com.japanese.vocabulary.test.clock.TestClockConfig
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.support.TransactionTemplate

@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfig::class, TestClockConfig::class)
abstract class BaseIntegrationTest {

    @Autowired
    protected lateinit var entityManager: EntityManager

    @Autowired
    protected lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    protected lateinit var clock: MutableClock

    @Autowired
    protected lateinit var transactionTemplate: TransactionTemplate

    @BeforeEach
    fun resetDatabase() {
        clock.setTo(TestClockConfig.DEFAULT_FIXED_INSTANT)
        truncateAllTables()
    }

    private fun truncateAllTables() {
        val tables = jdbcTemplate.queryForList(
            """
            SELECT table_name
              FROM information_schema.tables
             WHERE table_schema = DATABASE()
               AND table_type = 'BASE TABLE'
               AND table_name NOT LIKE 'flyway_%'
            """.trimIndent(),
            String::class.java,
        )
        if (tables.isEmpty()) return

        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0")
        try {
            tables.forEach { jdbcTemplate.execute("TRUNCATE TABLE `$it`") }
        } finally {
            jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1")
        }
    }
}
