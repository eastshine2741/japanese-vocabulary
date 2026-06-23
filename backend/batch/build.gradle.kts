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

    // Domains the batch process actually loads
    implementation(project(":domains:song"))
    implementation(project(":domains:song-analysis"))
    implementation(project(":domains:translation"))
    implementation(project(":domains:studystats"))
    implementation(project(":domains:notification"))
    implementation(project(":domains:user"))
    implementation(project(":domains:flashcard"))

    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-webflux")
    implementation("org.springframework.boot:spring-boot-starter-batch")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    runtimeOnly("io.micrometer:micrometer-registry-prometheus")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")

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
