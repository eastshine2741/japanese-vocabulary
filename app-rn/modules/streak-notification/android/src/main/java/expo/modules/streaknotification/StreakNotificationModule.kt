package expo.modules.streaknotification

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.content.res.Resources
import android.graphics.Color
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 연속 학습 알림을 제목·본문 모두 강조색인 커스텀 레이아웃으로 그린다. 만료 시각이 있으면(23:00) 오른쪽에 큰 빨간 카운트다운을 붙인다.
 * expo-notifications 로는 커스텀 뷰를 쓸 수 없어서 이 알림만 직접 만든다.
 * 탭은 앱을 열고 알림의 data 를 `onPress` 이벤트(또는 콜드 스타트면 [consumeInitialPress])로 넘긴다.
 */
class StreakNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("StreakNotification")

    Events("onPress")

    AsyncFunction("show") { title: String, body: String, channelId: String, expiresAt: Double?, accentColor: String, accentColorNight: String, data: Map<String, String> ->
      // 만료됐으면 카운트다운 없이 그린다.
      val remaining = expiresAt?.let { it.toLong() - System.currentTimeMillis() }?.takeIf { it > 0 }
      // 앱은 라이트 고정이라 앱 리소스 대신 시스템 설정으로 알림 셰이드 배경을 판단한다.
      val night = (Resources.getSystem().configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
      val accent = Color.parseColor(if (night) accentColorNight else accentColor)

      val extras = Bundle().apply { data.forEach { (k, v) -> putString(k, v) } }
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: return@AsyncFunction false
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      launch.putExtra(EXTRA_DATA, extras)
      val contentIntent = PendingIntent.getActivity(
        context,
        NOTIFICATION_ID,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

      val builder = NotificationCompat.Builder(context, channelId)
        .setSmallIcon(smallIcon())
        // 커스텀 뷰를 못 그리는 곳(잠금화면 공개 버전, 웨어러블)은 제목/본문을 쓴다.
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.DecoratedCustomViewStyle())
        .setCustomContentView(contentView(title, body, accent, remaining, collapsed = true))
        .setCustomBigContentView(contentView(title, body, accent, remaining, collapsed = false))
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_REMINDER)
        .setShowWhen(false)
        .setAutoCancel(true)
        .setContentIntent(contentIntent)
      remaining?.let { builder.setTimeoutAfter(it) }
      color()?.let { builder.setColor(it) }

      val manager = NotificationManagerCompat.from(context)
      if (!manager.areNotificationsEnabled()) return@AsyncFunction false
      try {
        manager.notify(NOTIFICATION_ID, builder.build())
      } catch (e: SecurityException) {
        return@AsyncFunction false
      }
      true
    }

    Function("consumeInitialPress") {
      val intent = appContext.currentActivity?.intent ?: return@Function null
      takeData(intent)
    }

    OnNewIntent { intent ->
      takeData(intent)?.let { sendEvent("onPress", it) }
    }
  }

  private fun contentView(title: String, body: String, accent: Int, remaining: Long?, collapsed: Boolean): RemoteViews =
    RemoteViews(context.packageName, R.layout.streak_countdown_notification).apply {
      setTextViewText(R.id.streak_title, title)
      setTextColor(R.id.streak_title, accent)
      setTextViewText(R.id.streak_body, body)
      setTextColor(R.id.streak_body, accent)
      setInt(R.id.streak_body, "setMaxLines", if (collapsed) 1 else 4)
      if (remaining == null) {
        setViewVisibility(R.id.streak_timer, View.GONE)
      } else {
        // Chronometer base 는 elapsedRealtime 기준이라 벽시계 만료 시각을 남은 시간으로 옮긴다.
        setChronometer(R.id.streak_timer, SystemClock.elapsedRealtime() + remaining, null, true)
        setChronometerCountDown(R.id.streak_timer, true)
      }
    }

  /** 탭으로 들어온 intent 에서 data 를 꺼내고, 같은 intent 로 두 번 처리하지 않도록 지운다. */
  private fun takeData(intent: Intent): Map<String, String>? {
    val extras = intent.getBundleExtra(EXTRA_DATA) ?: return null
    intent.removeExtra(EXTRA_DATA)
    return extras.keySet().mapNotNull { k -> extras.getString(k)?.let { k to it } }.toMap()
  }

  // expo-notifications 의 ExpoNotificationBuilder 와 같은 규칙: manifest meta-data, 없으면 앱 아이콘.
  private fun smallIcon(): Int =
    metaData()?.takeIf { it.containsKey(META_ICON) }?.getInt(META_ICON) ?: context.applicationInfo.icon

  private fun color(): Int? =
    metaData()?.takeIf { it.containsKey(META_COLOR) }?.let { context.resources.getColor(it.getInt(META_COLOR), null) }

  private fun metaData(): Bundle? =
    try {
      context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA).metaData
    } catch (e: Exception) {
      null
    }

  private companion object {
    const val NOTIFICATION_ID = 0x5743 // 한 번에 하나만. 같은 날 다시 오면 덮어쓴다.
    const val EXTRA_DATA = "kotonoha.streakNotification.data"
    const val META_ICON = "expo.modules.notifications.default_notification_icon"
    const val META_COLOR = "expo.modules.notifications.default_notification_color"
  }
}
