package com.japanese.vocabulary.notification

import com.google.auth.oauth2.GoogleCredentials
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.io.FileInputStream

/**
 * Initialises a [FirebaseApp] from a service-account JSON pointed at by
 * `GOOGLE_APPLICATION_CREDENTIALS`. Disabled by default; flip
 * `push.firebase.enabled=true` (production) to wire FCM up. Tests / local dev leave it off so the
 * app boots without a Firebase secret on disk.
 */
@Configuration
@ConditionalOnProperty(name = ["push.firebase.enabled"], havingValue = "true")
class FirebaseConfig {

    private val logger = LoggerFactory.getLogger(FirebaseConfig::class.java)

    @Bean
    fun firebaseApp(): FirebaseApp {
        val credentialsPath = System.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            ?: error("GOOGLE_APPLICATION_CREDENTIALS env not set; required when push.firebase.enabled=true")
        val credentials = FileInputStream(credentialsPath).use { GoogleCredentials.fromStream(it) }
        val options = FirebaseOptions.builder().setCredentials(credentials).build()
        return if (FirebaseApp.getApps().isEmpty()) {
            logger.info("Initializing FirebaseApp from {}", credentialsPath)
            FirebaseApp.initializeApp(options)
        } else {
            FirebaseApp.getInstance()
        }
    }

    @Bean
    fun firebaseMessaging(firebaseApp: FirebaseApp): FirebaseMessaging =
        FirebaseMessaging.getInstance(firebaseApp)
}
