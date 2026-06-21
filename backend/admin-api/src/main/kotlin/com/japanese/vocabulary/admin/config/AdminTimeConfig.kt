package com.japanese.vocabulary.admin.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock

@Configuration
class AdminTimeConfig {
    @Bean
    fun clock(): Clock = Clock.systemUTC()
}
