package com.japanese.autoconfigure.messagequeue

import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter
import org.springframework.amqp.support.converter.MessageConverter
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.ComponentScan

/**
 * 곡 분석 작업 큐의 클라이언트 쪽 배선.
 *
 * 브로커 토폴로지(exchange/queue/binding)는 여기서 선언하지 않는다. `k8s/{dev,prod}/rabbitmq/topology.yaml`
 * 의 Topology Operator CR 이 소유하고, 앱은 [com.japanese.vocabulary.messagequeue.SongAnalysisQueue]
 * 의 이름만 참조한다. 그래서 각 앱의 `spring.rabbitmq.dynamic` 은 false 다 — RabbitAdmin 이 뜨면
 * 진실 원천이 둘이 된다.
 *
 * `MessageConverter` 를 빈으로 올리면 Boot 의 RabbitTemplate 과 리스너 컨테이너가 둘 다 집어간다.
 */
@AutoConfiguration(before = [RabbitAutoConfiguration::class])
@ComponentScan(basePackages = ["com.japanese.vocabulary.messagequeue"])
class MessageQueueAutoConfiguration {

    @Bean
    fun rabbitMessageConverter(): MessageConverter = Jackson2JsonMessageConverter()
}
