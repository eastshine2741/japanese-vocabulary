# Push Notification

Push notification is split between the `notification` domain module and the `batch` application module.

## Responsibilities

- FCM send: `PushNotificationService` in `domains:notification`.
- Firebase wiring and FCM sender dependency: `FirebaseConfig` in `domains:notification`.
- Notification persistence: `NotificationLogEntity` in `domains:notification`.
- Candidate query: `PushNotificationQueryService` in `batch`.
- Scheduling: `PushNotificationScheduler` in `batch`, cron `09:00` and `18:00` KST.

`PushNotificationQueryService` combines several domain JPA repositories, including `UserRepository`, `UserSettingsRepository`, `DeviceTokenRepository`, `FlashcardRepository`, and `NotificationLogRepository`, then implements `PushNotificationDataPort.findCandidates()`.

The scheduler flow is:

```text
candidate query -> FCM send -> notification log write -> failed token cleanup
```

The `notification` module must not own scheduling or broad cross-domain reads. Those belong to `batch`.

## Firebase Secret

`FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` is a base64-encoded Firebase service account JSON. It is mounted into the batch pod at:

```text
/var/secrets/firebase/service-account.json
```

Generate it via Firebase console -> Service accounts -> Generate new private key.
