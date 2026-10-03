plugins {
    id("org.springframework.boot")
    id("io.spring.dependency-management")
    kotlin("jvm")
    kotlin("plugin.spring")
    kotlin("plugin.jpa")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
}

dependencies {
    implementation(project(":common"))

    // Domains the cron tasks actually load. 곡 분석 파이프라인은 worker 로 갔다.
    implementation(project(":domains:song"))
    implementation(project(":domains:recommendation"))
    implementation(project(":domains:studystats"))
    implementation(project(":domains:notification"))
    implementation(project(":domains:user"))
    implementation(project(":integrations:apple-music-rss"))
    implementation(project(":integrations:song-search"))

    // 상주 서버가 아니라 한 번 실행하고 끝나는 컨테이너라 web/actuator 는 싣지 않는다.
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    implementation("org.springframework.boot:spring-boot-starter-batch")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")

    // Sentry
    implementation("io.sentry:sentry-spring-boot-starter-jakarta:7.18.0")
    implementation("io.sentry:sentry-logback:7.18.0")

    // MySQL
    runtimeOnly("com.mysql:mysql-connector-j")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation(testFixtures(project(":common")))
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs += "-Xjsr305=strict"
        jvmTarget = "17"
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
    // Testcontainers' shaded docker-java client defaults to API 1.32, which Docker 25+ rejects.
    systemProperty("api.version", "1.43")
    environment("DOCKER_API_VERSION", "1.43")
}
