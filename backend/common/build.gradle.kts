plugins {
    kotlin("jvm")
    kotlin("plugin.spring")
    kotlin("plugin.jpa")
    id("io.spring.dependency-management")
    `java-test-fixtures`
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    runtimeOnly("com.mysql:mysql-connector-j")

    testFixturesApi("org.springframework.boot:spring-boot-starter-test:3.4.3")
    testFixturesApi("org.springframework.boot:spring-boot-testcontainers:3.4.3")
    testFixturesApi("org.springframework.boot:spring-boot-starter-data-jpa:3.4.3")
    testFixturesApi("org.flywaydb:flyway-mysql:10.20.1")
    testFixturesApi("org.testcontainers:testcontainers:1.21.4")
    testFixturesApi("org.testcontainers:mysql:1.21.4")
    testFixturesApi("org.testcontainers:junit-jupiter:1.21.4")
    testFixturesApi("com.github.docker-java:docker-java-api:3.7.1")
    testFixturesApi("com.github.docker-java:docker-java-transport-zerodep:3.7.1")
    testFixturesApi("io.mockk:mockk:1.13.10")
    testFixturesApi("com.ninja-squad:springmockk:4.0.2")
    testFixturesRuntimeOnly("com.mysql:mysql-connector-j:8.3.0")
}

dependencyManagement {
    imports {
        mavenBom(org.springframework.boot.gradle.plugin.SpringBootPlugin.BOM_COORDINATES)
    }
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs += "-Xjsr305=strict"
        jvmTarget = "17"
    }
}
