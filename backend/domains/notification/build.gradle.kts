dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")

    // Pinned version; no floating range. Exposed as api so batch and its tests can use FirebaseMessaging types.
    api("com.google.firebase:firebase-admin:9.4.3")
}
