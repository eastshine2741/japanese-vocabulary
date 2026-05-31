package com.japanese.vocabulary.test

import org.junit.jupiter.api.AfterEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate

/**
 * Base for direct-call tests of @TransactionalEventListener(AFTER_COMMIT) listeners.
 *
 * Those listeners must be annotated @Transactional(REQUIRES_NEW) in production (see CLAUDE.md),
 * which conflicts with the default test rollback: the outer test tx holds row locks the inner
 * connection cannot bypass, producing PessimisticLockingFailureException.
 *
 * This base opts out of the test-managed transaction (NOT_SUPPORTED is the officially supported
 * propagation for that). Setup data must therefore be committed explicitly via inTx { ... },
 * and TRUNCATE in @AfterEach replaces rollback as the cleanup mechanism.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
abstract class AfterCommitListenerTest : ApiBaseIntegrationTest() {

    @Autowired
    private lateinit var transactionManager: PlatformTransactionManager

    @Autowired
    private lateinit var jdbcTemplate: JdbcTemplate

    private val txTemplate: TransactionTemplate by lazy { TransactionTemplate(transactionManager) }

    protected fun <T> inTx(block: () -> T): T = txTemplate.execute { block() }!!

    @AfterEach
    fun truncateAllTables() {
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
        tables.forEach { jdbcTemplate.execute("TRUNCATE TABLE $it") }
        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1")
    }
}
