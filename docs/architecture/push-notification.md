# Push Notification

Push notification is split between the `notification` domain module and the `batch` application module.

## Responsibilities

- FCM/APNs visible push send: `PushNotificationService` in `domains:notification`.
- Firebase wiring and FCM sender dependency: `FirebaseConfig` in `domains:notification`.
- Notification persistence: `NotificationLogEntity` in `domains:notification`.
- Streak reminder (who / when / what): `StreakReminderScheduler` in `batch`, cron `20:00` and
  `23:00` KST. Copy lives in `StreakReminderMessage`; rules are in
  `docs/product-intents/260918-streak-commitment.md` section C. Payload `data.type` is
  `streak_reminder`. The former 09:00 / 18:00 word-recall reminder (`review_reminder`) is gone.
- Manual trigger: `POST /dev/push/trigger?slot=EVENING|NIGHT` runs one slot immediately.
- Manual single-user dispatch: `POST /dev/push/send` in the `batch` service. It requires
  `X-Manual-Push-Secret: $MANUAL_PUSH_SECRET`, accepts `{userId,title,body,data}`, and sends the
  message to every device token registered to that user. If `MANUAL_PUSH_SECRET` is blank, the
  endpoint rejects every request.

`StreakReminderScheduler.findCandidates()` reads `DeviceTokenRepository`, `UserSettingsRepository`,
`DailyStudySummaryRepository` and `StreakCalculator` directly. A user is a candidate when they have a
token, notifications are on, they have at least one study day, and no review yet on today's KST
04:00 study date.

The scheduler flow is:

```text
candidate query -> FCM/APNs send -> notification log write -> failed token cleanup
```

The manual single-user flow is:

```text
userId -> registered device tokens -> FCM/APNs send -> notification log write -> failed token cleanup
```

The `notification` module must not own scheduling or broad cross-domain reads. Those belong to `batch`.

## Firebase Secret

`FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` is a base64-encoded Firebase service account JSON. It is mounted into the batch pod at:

```text
/var/secrets/firebase/service-account.json
```

Generate it via Firebase console -> Service accounts -> Generate new private key.
