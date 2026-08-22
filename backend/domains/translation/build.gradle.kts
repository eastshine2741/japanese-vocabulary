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
}
