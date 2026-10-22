package com.japanese.vocabulary.translation.client

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.context.properties.bind.Binder
import org.springframework.boot.context.properties.source.ConfigurationPropertySources
import org.springframework.boot.env.YamlPropertySourceLoader
import org.springframework.core.io.FileSystemResource

/** 표에 없는 모델은 비용이 조용히 0 이 되므로, 모델을 바꾸거나 키의 [] 를 빼면 여기서 깨져야 한다. */
class LlmPricingConfigTest {

    // 테스트 리소스의 application.yml 이 classpath 에서 main 것을 가리므로 파일로 읽는다.
    private val binder = Binder(
        ConfigurationPropertySources.from(
            YamlPropertySourceLoader().load("worker-main", FileSystemResource("src/main/resources/application.yml")),
        ),
    )

    @Test
    fun `the worker price table covers exactly the models it calls`() {
        val pricing = binder.bind("kotonoha.llm", LlmPricingProperties::class.java).get().pricing
        val models = listOf("gemini.translation-model", "gemini.word-meaning-model", "gemini.segmentation-model", "jev.model")
            .map { binder.bind(it, String::class.java).get() }

        assertThat(pricing.keys).containsExactlyInAnyOrderElementsOf(models.toSet())
        assertThat(pricing.values).allSatisfy { assertThat(it.input).isPositive() }
    }
}
