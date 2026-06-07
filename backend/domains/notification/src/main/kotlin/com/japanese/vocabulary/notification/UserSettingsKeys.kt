package com.japanese.vocabulary.notification

/**
 * Mirror of the JSON key used by the api module's `UserSettingsService` to flag whether a user
 * has opted in to push notifications. The batch module cannot depend on api (see
 * `settings.gradle.kts` — batch → common only), so the key is duplicated here.
 *
 * MUST stay in sync with `com.japanese.vocabulary.user.service.UserSettingsService.NOTIFICATIONS_ENABLED_KEY`.
 * `PushNotificationDataAccessIntegrationTest` exercises the real schema with this constant, so a
 * drift between the api source-of-truth and this mirror will surface as a failing test.
 */
const val NOTIFICATIONS_ENABLED_KEY: String = "notificationsEnabled"
