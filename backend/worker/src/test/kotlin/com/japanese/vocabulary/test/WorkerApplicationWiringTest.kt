package com.japanese.vocabulary.test

import com.japanese.vocabulary.WorkerApplication
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.SpringBootApplication

class WorkerApplicationWiringTest {

    @Test
    fun `worker bootstrap does not use broad root component scan`() {
        val annotation = WorkerApplication::class.java.getAnnotation(SpringBootApplication::class.java)

        assertThat(annotation.scanBasePackages).containsExactly("com.japanese.vocabulary.worker")
    }

    @Test
    fun `worker classpath exposes module-owned auto configurations`() {
        val imports = loadAutoConfigurationImports()

        assertThat(imports).contains(
            "com.japanese.autoconfigure.song.SongAutoConfiguration",
            "com.japanese.autoconfigure.songanalysis.SongAnalysisAutoConfiguration",
            "com.japanese.autoconfigure.translation.TranslationAutoConfiguration",
            "com.japanese.autoconfigure.lyricsearch.LyricSearchAutoConfiguration",
            "com.japanese.autoconfigure.mvsearch.MvSearchAutoConfiguration",
            "com.japanese.autoconfigure.messagequeue.MessageQueueAutoConfiguration",
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
