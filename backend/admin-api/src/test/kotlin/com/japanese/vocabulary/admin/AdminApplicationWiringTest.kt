package com.japanese.vocabulary.admin

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.NoSuchBeanDefinitionException
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc

@AutoConfigureMockMvc
class AdminApplicationWiringTest : AdminBaseIntegrationTest() {
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
}
