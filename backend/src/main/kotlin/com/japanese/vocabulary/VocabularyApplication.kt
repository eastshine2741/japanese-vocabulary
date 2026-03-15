package com.japanese.vocabulary

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class VocabularyApplication

fun main(args: Array<String>) {
    runApplication<VocabularyApplication>(*args)
}
