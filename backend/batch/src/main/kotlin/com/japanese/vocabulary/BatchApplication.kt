package com.japanese.vocabulary

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

/**
 * 시간 기반 정기 작업 전용. 상주하지 않고 `--task=<name>` 하나를 실행한 뒤 종료하며, 스케줄은
 * k8s CronJob 이 들고 있다 ([com.japanese.vocabulary.batch.CronTaskRunner]).
 *
 * 유저 액션에 따라 즉시 돌아야 하는 곡 분석은 `worker` 가 메시지 큐로 처리한다.
 */
@SpringBootApplication(scanBasePackages = ["com.japanese.vocabulary.batch"])
class BatchApplication

fun main(args: Array<String>) {
    runApplication<BatchApplication>(*args)
}
