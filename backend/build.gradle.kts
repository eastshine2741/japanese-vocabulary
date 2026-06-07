import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    id("org.springframework.boot") version "3.4.3" apply false
    id("io.spring.dependency-management") version "1.1.7" apply false
    kotlin("jvm") version "1.9.22" apply false
    kotlin("plugin.spring") version "1.9.22" apply false
    kotlin("plugin.jpa") version "1.9.22" apply false
}

subprojects {
    group = "com.japanese"
    version = "0.0.1-SNAPSHOT"

    repositories {
        mavenCentral()
    }
}

// Shared configuration for all domain modules under :domains:*
configure(subprojects.filter { it.path.startsWith(":domains:") }) {
    apply(plugin = "org.jetbrains.kotlin.jvm")
    apply(plugin = "org.jetbrains.kotlin.plugin.spring")
    apply(plugin = "org.jetbrains.kotlin.plugin.jpa")
    apply(plugin = "io.spring.dependency-management")
    apply(plugin = "java-test-fixtures")

    extensions.configure<JavaPluginExtension> {
        sourceCompatibility = JavaVersion.VERSION_17
    }

    dependencies {
        "implementation"(project(":common"))
        "implementation"("org.springframework.boot:spring-boot-starter-data-jpa")
        "implementation"("com.fasterxml.jackson.module:jackson-module-kotlin")
        "implementation"("org.jetbrains.kotlin:kotlin-reflect")
        // Web/security are bootstrap concerns; domains use them only as compile-time API.
        "compileOnly"("org.springframework:spring-web")
        "compileOnly"("org.springframework:spring-webflux")
        "compileOnly"("org.springframework.boot:spring-boot-starter-security")
        "compileOnly"("jakarta.servlet:jakarta.servlet-api")

        "testImplementation"("org.springframework.boot:spring-boot-starter-test")
        "testImplementation"(testFixtures(project(":common")))
    }

    the<io.spring.gradle.dependencymanagement.dsl.DependencyManagementExtension>().imports {
        mavenBom(org.springframework.boot.gradle.plugin.SpringBootPlugin.BOM_COORDINATES)
    }

    tasks.withType<KotlinCompile> {
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
}
