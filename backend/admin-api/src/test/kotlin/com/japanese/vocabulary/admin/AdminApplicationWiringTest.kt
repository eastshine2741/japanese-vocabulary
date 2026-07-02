package com.japanese.vocabulary.admin

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.NoSuchBeanDefinitionException
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping

@AutoConfigureMockMvc
class AdminApplicationWiringTest : AdminBaseIntegrationTest() {
    @org.springframework.beans.factory.annotation.Autowired
    private lateinit var requestMappingHandlerMapping: RequestMappingHandlerMapping

    @Test
    fun `admin api starts without song runtime beans`() {
        listOf(
            "youtubeClient",
            "lrclibClient",
            "vocadbClient",
            "songSearchCache",
            "recentSongService",
        ).forEach { beanName ->
            org.junit.jupiter.api.assertThrows<NoSuchBeanDefinitionException> {
                applicationContext.getBean(beanName)
            }
        }
    }

    @Test
    fun `admin api has no resource mutation mappings beyond allowed workflows`() {
        val mutatingMappings = requestMappingHandlerMapping.handlerMethods.keys
            .filter { it.patternValues.any { pattern -> pattern.startsWith("/admin/api/") } }
            .flatMap { info ->
                info.methodsCondition.methods.map { method -> "${method.name} ${info.patternValues}" }
            }
            .filterNot {
                it in setOf(
                    "POST [/admin/api/auth/login]",
                    "POST [/admin/api/recommendations/dispatch-analysis]",
                    "POST [/admin/api/recommendations/reconcile-completed]",
                )
            }
            .filter { it.startsWith("POST ") || it.startsWith("PUT ") || it.startsWith("PATCH ") || it.startsWith("DELETE ") }

        assertThat(mutatingMappings).isEmpty()
    }
}
