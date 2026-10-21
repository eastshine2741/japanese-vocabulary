package com.japanese.vocabulary

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

/** `@Scheduled` 는 메트릭 게이지 캐시 갱신뿐이다. 시간 기반 정기 작업은 `batch` 모듈의 CronJob 이 맡는다. */
@SpringBootApplication(scanBasePackages = ["com.japanese.vocabulary.api"])
@EnableScheduling
class ApiApplication

fun main(args: Array<String>) {
    runApplication<ApiApplication>(*args)
}
