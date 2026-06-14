dependencies {
    implementation(project(":domains:song"))

    implementation("org.springframework.boot:spring-boot-starter-webflux")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")

    // jisho.org lookups (JishoClient) are cached in Redis. Available transitively via :domains:song,
    // but declared explicitly here since RedisCache/StringRedisTemplate are used at this site.
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
}
