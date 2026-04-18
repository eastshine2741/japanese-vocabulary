FROM eclipse-temurin:17-jdk AS build
WORKDIR /app

# TODO: Gradle 캐싱 최적화 - 빌드 설정만 먼저 복사하여 의존성 레이어를 캐싱
# COPY gradle/ gradle/
# COPY gradlew build.gradle.kts settings.gradle.kts ./
# RUN ./gradlew dependencies
# COPY src/ src/

COPY . .
RUN ./gradlew bootJar

# TODO: backend/.dockerignore 작성 - .gradle/, build/, .git/ 등 제외

FROM eclipse-temurin:17-jre
COPY --from=build /app/build/libs/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]