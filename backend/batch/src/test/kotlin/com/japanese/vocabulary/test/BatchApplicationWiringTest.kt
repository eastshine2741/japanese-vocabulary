package com.japanese.vocabulary.test

import com.japanese.vocabulary.BatchApplication
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.SpringBootApplication

class BatchApplicationWiringTest {

    @Test
    fun `batch bootstrap does not use broad root component scan`() {
        val annotation = BatchApplication::class.java.getAnnotation(SpringBootApplication::class.java)

        assertThat(annotation.scanBasePackages).containsExactly("com.japanese.vocabulary.batch")
    }

    @Test
    fun `batch classpath exposes module-owned auto configurations`() {
        val imports = loadAutoConfigurationImports()

        assertThat(imports).contains(
            "com.japanese.autoconfigure.song.SongAutoConfiguration",
            "com.japanese.autoconfigure.songanalysis.SongAnalysisAutoConfiguration",
            "com.japanese.autoconfigure.translation.TranslationAutoConfiguration",
            "com.japanese.autoconfigure.lyricsearch.LyricSearchAutoConfiguration",
            "com.japanese.autoconfigure.mvsearch.MvSearchAutoConfiguration",
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
