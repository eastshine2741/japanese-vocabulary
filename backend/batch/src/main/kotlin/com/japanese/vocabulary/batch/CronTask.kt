package com.japanese.vocabulary.batch

import org.springframework.boot.ApplicationArguments

/**
 * CronJob 한 번 실행에 대응하는 작업. `batch` 는 상주 프로세스가 아니라 `--task=<name>` 으로
 * 하나를 실행하고 끝나는 컨테이너라서, 스케줄은 k8s CronJob 이 들고 있고 여기엔 실행할 내용만 있다.
 *
 * 유저 액션에 따라 즉시 돌아야 하는 곡 분석은 여기가 아니라 `worker` 가 큐로 처리한다.
 * 이름이 Job 이 아닌 이유는 Spring Batch 의 `Job` 빈과 구분하기 위해서다.
 */
interface CronTask {
    val name: String

    fun run(args: ApplicationArguments)
}
