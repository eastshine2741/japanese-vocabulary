dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webflux")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    api("io.micrometer:micrometer-core")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")

    // Japanese morphological analyzers (Kuromoji ensemble) — song's translation pipeline
    implementation("com.atilika.kuromoji:kuromoji-ipadic:0.9.0")
    implementation("com.atilika.kuromoji:kuromoji-unidic:0.9.0")
}
