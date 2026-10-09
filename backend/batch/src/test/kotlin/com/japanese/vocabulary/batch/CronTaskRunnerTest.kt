package com.japanese.vocabulary.batch

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.DefaultApplicationArguments

/**
 * CronJob 컨테이너의 유일한 진입점. 여기서 잘못 고르거나 조용히 성공하면 정기 작업이 통째로
 * 안 돌아가므로, 이름 매칭과 실패 전파만큼은 컨텍스트 없이도 지킨다.
 */
class CronTaskRunnerTest {

    private class RecordingTask(override val name: String) : CronTask {
        var ranWith: ApplicationArguments? = null
        override fun run(args: ApplicationArguments) {
            ranWith = args
        }
    }

    @Test
    fun `runs only the task named by --task`() {
        val wanted = RecordingTask("freeze-consume")
        val other = RecordingTask("streak-reminder")
        val runner = CronTaskRunner(listOf(wanted, other))

        runner.run(DefaultApplicationArguments("--task=freeze-consume", "--runDate=2026-05-01"))

        assertThat(wanted.ranWith?.getOptionValues("runDate")).containsExactly("2026-05-01")
        assertThat(other.ranWith).isNull()
    }

    @Test
    fun `unknown task fails instead of exiting successfully`() {
        val runner = CronTaskRunner(listOf(RecordingTask("freeze-consume")))

        assertThatThrownBy { runner.run(DefaultApplicationArguments("--task=nope")) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("freeze-consume")
    }

    @Test
    fun `missing --task fails`() {
        val runner = CronTaskRunner(listOf(RecordingTask("freeze-consume")))

        assertThatThrownBy { runner.run(DefaultApplicationArguments()) }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `task failure propagates so the k8s Job fails`() {
        val exploding = object : CronTask {
            override val name = "boom"
            override fun run(args: ApplicationArguments) = throw IllegalStateException("job blew up")
        }
        val runner = CronTaskRunner(listOf(exploding))

        assertThatThrownBy { runner.run(DefaultApplicationArguments("--task=boom")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessage("job blew up")
    }
}
