package com.japanese.vocabulary.batch

import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

/**
 * `--task=<name>` 하나를 실행하고 끝난다. 예외를 그대로 던지므로 프로세스는 exit code 1 로 나가고
 * k8s Job 이 실패로 남는다. 성공하면 `main` 이 컨텍스트를 닫고 exit code 0 으로 끝낸다.
 *
 * `@SpringBootTest` 도 ApplicationRunner 를 실행하므로, 테스트에서는
 * `batch.task-runner.enabled=false` 로 꺼 둔다.
 */
@Component
@ConditionalOnProperty(name = ["batch.task-runner.enabled"], havingValue = "true", matchIfMissing = true)
class CronTaskRunner(
    private val tasks: List<CronTask>,
) : ApplicationRunner {
    private val logger = LoggerFactory.getLogger(CronTaskRunner::class.java)

    override fun run(args: ApplicationArguments) {
        val requested = args.getOptionValues(TASK_OPTION)?.firstOrNull()
            ?: throw IllegalArgumentException("--$TASK_OPTION=<name> is required. available tasks: ${availableNames()}")
        val task = tasks.find { it.name == requested }
            ?: throw IllegalArgumentException("Unknown task '$requested'. available tasks: ${availableNames()}")

        logger.info("Running task '{}'", task.name)
        task.run(args)
        logger.info("Task '{}' finished", task.name)
    }

    private fun availableNames() = tasks.map { it.name }.sorted()

    private companion object {
        const val TASK_OPTION = "task"
    }
}
