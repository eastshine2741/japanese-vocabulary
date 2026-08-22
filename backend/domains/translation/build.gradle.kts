dependencies {
    implementation(project(":domains:song"))

    implementation("org.springframework.boot:spring-boot-starter-webflux")
    // gemini_call_log (payload 조사용 임시 테이블) 때문에 JPA를 직접 쓴다. :domains:song 으로 전이되지만
    // 사용 지점이 이 모듈이라 명시한다. TODO: Loki 이관 시 이 의존성도 같이 제거.
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")

    // jisho.org lookups (JishoClient) are cached in Redis. Available transitively via :domains:song,
    // but declared explicitly here since RedisCache/StringRedisTemplate are used at this site.
    implementation("org.springframework.boot:spring-boot-starter-data-redis")

    // LexicalResolverTest stubs JishoService to exercise entry narrowing without a network call.
    // Same mockk the bootstrap modules use; domain modules do not get :common's test fixtures.
    testImplementation("io.mockk:mockk:1.13.10")
}

// The Step 9 measurement harness (`EntrySelectHarness`) talks to the live Gemini and jisho APIs, so
// it needs the key and its run parameters from outside the build. It stays skipped unless
// `-Dharness.input` is given, which is what keeps a normal `:domains:translation:test` free.
tasks.withType<Test> {
    // providers.environmentVariable, not System.getenv: the latter reads the long-lived Gradle
    // daemon's own environment, which does not pick up a key exported after the daemon started.
    providers.environmentVariable("GEMINI_API_KEY").orNull?.let { environment("GEMINI_API_KEY", it) }
    listOf(
        "harness.input",
        "harness.output",
        "harness.jisho.cache",
        "harness.segmentation.model",
        "harness.translation.model",
        "harness.word.model",
    ).forEach { key -> System.getProperty(key)?.let { systemProperty(key, it) } }
}
