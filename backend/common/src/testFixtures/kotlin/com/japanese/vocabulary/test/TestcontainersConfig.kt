package com.japanese.vocabulary.test

import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.testcontainers.service.connection.ServiceConnection
import org.springframework.context.annotation.Bean
import org.springframework.test.context.DynamicPropertyRegistrar
import org.testcontainers.containers.GenericContainer
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName

@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfig {

    @Bean
    @ServiceConnection
    fun mysqlContainer(): MySQLContainer<*> =
        MySQLContainer(DockerImageName.parse("mysql:8.4"))
            .withDatabaseName("japanese_vocabulary_test")
            .withReuse(true)

    @Bean
    fun redisContainer(): GenericContainer<*> =
        GenericContainer(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(REDIS_PORT)
            .withReuse(true)

    @Bean
    fun redisProperties(
        @Qualifier("redisContainer") redisContainer: GenericContainer<*>,
    ): DynamicPropertyRegistrar = DynamicPropertyRegistrar { registry ->
        registry.add("spring.data.redis.host") { redisContainer.host }
        registry.add("spring.data.redis.port") { redisContainer.getMappedPort(REDIS_PORT) }
    }

    private companion object {
        const val REDIS_PORT = 6379
    }
}
