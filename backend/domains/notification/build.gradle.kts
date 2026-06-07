dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")

    // Firebase Admin SDK for FCM push delivery (pinned — floating range forbidden by plan AC-BATCH-1).
    // Exposed as api so the bootstrap (batch) and its tests can reference FirebaseMessaging types
    // when wiring the actual sender and writing service tests.
    api("com.google.firebase:firebase-admin:9.4.3")
}
