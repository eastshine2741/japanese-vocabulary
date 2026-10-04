package com.japanese.vocabulary

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

/**
 * 곡 분석 파이프라인 consumer. 유저/어드민 액션이 만든 작업 메시지를 받아 즉시 처리한다.
 * `@Scheduled` 는 큐 안전망인 [com.japanese.vocabulary.song.worker.SongAnalysisWorkSweeper] 하나뿐이고,
 * 시간 기반 정기 작업은 `batch` 모듈의 CronJob 이 맡는다.
 */
@SpringBootApplication(scanBasePackages = ["com.japanese.vocabulary.worker"])
@EnableScheduling
class WorkerApplication

fun main(args: Array<String>) {
    runApplication<WorkerApplication>(*args)
}
