# Push Notification

Push notification is split between the `notification` domain module and the application modules that
decide who gets what: `batch` (streak reminder CronJob), `worker` (analysis-completed push), and
`admin-api` (operator manual send).

## Responsibilities

- FCM/APNs visible push send: `PushNotificationService` in `domains:notification`.
- Firebase wiring and FCM sender dependency: `FirebaseConfig` in `domains:notification`.
- Notification persistence: `NotificationLogEntity` in `domains:notification`.
- Streak reminder (who / when / what): `StreakReminderTask` in `batch`, run by the
  `streak-reminder-evening` / `streak-reminder-night` CronJobs at `20:00` and `23:00` KST
  (`--task=streak-reminder --slot=EVENING|NIGHT`). Copy lives in `StreakReminderMessage`; rules are in
  `docs/product-intents/260918-streak-commitment.md` section C. Payload `data.type` is
  `streak_reminder`. The former 09:00 / 18:00 word-recall reminder (`review_reminder`) is gone.
  The 23:00 slot also carries `data.expiresAt` (epoch ms of the next 04:00 KST) for the client
  countdown and is sent with `androidDataOnly = true`: no notification block on Android, so the
  app renders it from `data.title` / `data.body`; iOS still gets a visible APNs alert. Payload and
  copy: `docs/product-intents/260918-streak-commitment-api.md` section 3.
- Karaoke new songs: `KaraokeNewSongNotifier` in `batch`, run by the `karaoke-collect` CronJob at
  `18:00` KST right after collection. One push per run to users with `karaokeNewSongNotifications` (opt-in,
  default false) and `notificationsEnabled`. Payload `data.type` is `karaoke_new_songs`. Rules:
  `docs/karaoke-new-songs.md`.
- Manual trigger of a slot: create a Job from the CronJob —
  `kubectl create job --from=cronjob/streak-reminder-evening sr-$(date +%s) -n <ns>`.
- Manual single-user dispatch: `POST /admin/api/push/send` in `admin-api`, behind the normal admin
  bearer token (the old `/dev/push/send` shared-secret endpoint in `batch` is gone). It accepts
  `{userId,title,body,data}` and sends to every device token registered to that user. The route only
  exists when `PUSH_FIREBASE_ENABLED=true`.
- Analysis-completed push: `AnalysisNotificationDispatcher` in `worker`, on the `AFTER_COMMIT`
  `SongAnalysisCompletedEvent`.

`StreakReminderTask.findCandidates()` reads `DeviceTokenRepository`, `UserSettingsRepository`,
`DailyStudySummaryRepository` and `StreakCalculator` directly. A user is a candidate when they have a
token, notifications are on, they have at least one study day, and no review yet on today's KST
04:00 study date.

The task flow is:

```text
candidate query -> FCM/APNs send -> notification log write -> failed token cleanup
```

The manual single-user flow is:

```text
userId -> registered device tokens -> FCM/APNs send -> notification log write -> failed token cleanup
```

The `notification` module must not own scheduling or broad cross-domain reads. Those belong to the
bootstrap module that owns the behavior — `batch` for time-based reminders, `worker` for
analysis-driven ones.

## Firebase Secret

`FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` is a base64-encoded Firebase service account JSON. The
`firebase-credentials` secret is mounted into the worker, batch cron, and admin-api pods at:

```text
/var/secrets/firebase/service-account.json
```

Generate it via Firebase console -> Service accounts -> Generate new private key.
