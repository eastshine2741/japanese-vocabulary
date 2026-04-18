FROM eclipse-temurin:17-jdk AS build
WORKDIR /app

# 1) Gradle wrapper + 빌드 설정만 먼저 복사 → 의존성 레이어 캐싱
COPY gradle/ gradle/
COPY gradlew build.gradle.kts settings.gradle.kts ./
RUN ./gradlew dependencies --no-daemon

# 2) 소스 복사 → bootJar (의존성 변경 없으면 위 레이어는 캐시 히트)
COPY src/ src/
RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:17-jre
COPY --from=build /app/build/libs/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
