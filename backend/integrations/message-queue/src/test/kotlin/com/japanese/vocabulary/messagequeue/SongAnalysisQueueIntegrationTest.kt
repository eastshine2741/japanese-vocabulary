package com.japanese.vocabulary.messagequeue

import com.japanese.autoconfigure.messagequeue.MessageQueueAutoConfiguration
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.amqp.core.Binding
import org.springframework.amqp.core.BindingBuilder
import org.springframework.amqp.core.DirectExchange
import org.springframework.amqp.core.Queue
import org.springframework.amqp.core.QueueBuilder
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.ImportAutoConfiguration
import org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.test.context.DynamicPropertyRegistrar
import org.testcontainers.containers.RabbitMQContainer
import org.testcontainers.utility.DockerImageName
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * 발행한 메시지가 JSON 으로 왕복하는지 본다. 여기서 깨지면 worker 는 영영 메시지를 못 받는다.
 *
 * 운영 토폴로지는 Topology Operator CR 이 소유하므로 이 테스트가 검증하지 못한다. 여기서는
 * [Topology] 가 같은 모양을 테스트 전용으로 선언한다 — 이름은 [SongAnalysisQueue] 상수를 공유하지만,
 * durable/DLX 같은 속성이 CR 과 어긋나는 것은 잡히지 않는다. CR 쪽 검증은 배포 후
 * `kubectl get queues.rabbitmq.com` 의 Ready 조건으로 한다.
 */
@SpringBootTest(classes = [SongAnalysisQueueIntegrationTest.TestApp::class])
@Import(SongAnalysisQueueIntegrationTest.Containers::class, SongAnalysisQueueIntegrationTest.Topology::class)
class SongAnalysisQueueIntegrationTest {

    @Autowired private lateinit var publisher: SongAnalysisWorkQueuePublisher
    @Autowired private lateinit var consumer: TestConsumer

    @Test
    fun `published work id round-trips through the queue`() {
        publisher.publish(4242L)

        assertThat(consumer.take()).isEqualTo(SongAnalysisWorkMessage(4242L))
    }

    @Configuration(proxyBeanMethods = false)
    @ImportAutoConfiguration(RabbitAutoConfiguration::class, MessageQueueAutoConfiguration::class)
    class TestApp {
        @Bean
        fun testConsumer() = TestConsumer()
    }

    /**
     * `@ServiceConnection` 대신 속성을 직접 등록한다. 이 테스트는 자동 설정을 두 개만 불러오는데,
     * 서비스 커넥션은 별도 자동 설정이 떠 있어야 붙는다. common 의 redis 컨테이너와 같은 방식.
     */
    @TestConfiguration(proxyBeanMethods = false)
    class Containers {
        @Bean
        fun rabbitmqContainer(): RabbitMQContainer =
            RabbitMQContainer(DockerImageName.parse("rabbitmq:4-management"))

        @Bean
        fun rabbitmqProperties(rabbitmqContainer: RabbitMQContainer): DynamicPropertyRegistrar =
            DynamicPropertyRegistrar { registry ->
                registry.add("spring.rabbitmq.host") { rabbitmqContainer.host }
                registry.add("spring.rabbitmq.port") { rabbitmqContainer.amqpPort }
                registry.add("spring.rabbitmq.username") { rabbitmqContainer.adminUsername }
                registry.add("spring.rabbitmq.password") { rabbitmqContainer.adminPassword }
            }
    }

    /** 운영에서는 CR 이 만드는 것들. 테스트 브로커에는 아무것도 없으므로 여기서 만든다. */
    @TestConfiguration(proxyBeanMethods = false)
    class Topology {
        @Bean
        fun exchange() = DirectExchange(SongAnalysisQueue.EXCHANGE, true, false)

        @Bean
        fun deadLetterExchange() = DirectExchange(SongAnalysisQueue.DEAD_LETTER_EXCHANGE, true, false)

        @Bean
        fun workQueue(): Queue = QueueBuilder.durable(SongAnalysisQueue.QUEUE)
            .deadLetterExchange(SongAnalysisQueue.DEAD_LETTER_EXCHANGE)
            .deadLetterRoutingKey(SongAnalysisQueue.ROUTING_KEY)
            .build()

        @Bean
        fun deadLetterQueue(): Queue = QueueBuilder.durable(SongAnalysisQueue.DEAD_LETTER_QUEUE).build()

        @Bean
        fun workBinding(workQueue: Queue, exchange: DirectExchange): Binding =
            BindingBuilder.bind(workQueue).to(exchange).with(SongAnalysisQueue.ROUTING_KEY)

        @Bean
        fun deadLetterBinding(deadLetterQueue: Queue, deadLetterExchange: DirectExchange): Binding =
            BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange).with(SongAnalysisQueue.ROUTING_KEY)
    }

    class TestConsumer {
        private val messages = LinkedBlockingQueue<SongAnalysisWorkMessage>()

        @RabbitListener(queues = [SongAnalysisQueue.QUEUE])
        fun onMessage(message: SongAnalysisWorkMessage) {
            messages.put(message)
        }

        fun take(): SongAnalysisWorkMessage? = messages.poll(30, TimeUnit.SECONDS)
    }
}
