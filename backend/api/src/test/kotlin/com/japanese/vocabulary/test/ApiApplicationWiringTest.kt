package com.japanese.vocabulary.test

import com.japanese.vocabulary.ApiApplication
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.SpringBootApplication

class ApiApplicationWiringTest {

    @Test
    fun `api bootstrap does not use broad root component scan`() {
        val annotation = ApiApplication::class.java.getAnnotation(SpringBootApplication::class.java)

        assertThat(annotation.scanBasePackages).containsExactly("com.japanese.vocabulary.api")
    }

    @Test
    fun `api classpath exposes module-owned auto configurations`() {
        val imports = loadAutoConfigurationImports()

        assertThat(imports).contains(
            "com.japanese.autoconfigure.auth.AuthAutoConfiguration",
            "com.japanese.autoconfigure.song.SongAutoConfiguration",
            "com.japanese.autoconfigure.songanalysis.SongAnalysisAutoConfiguration",
            "com.japanese.autoconfigure.songsearch.SongSearchAutoConfiguration",
        )
    }

    private fun loadAutoConfigurationImports(): List<String> =
        Thread.currentThread()
            .contextClassLoader
            .getResources("META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports")
            .asSequence()
            .flatMap { it.readText().lineSequence() }
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toList()
}
