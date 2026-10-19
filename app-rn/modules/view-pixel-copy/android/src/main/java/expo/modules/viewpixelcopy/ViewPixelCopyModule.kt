package expo.modules.viewpixelcopy

import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.PixelCopy
import android.view.View
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import kotlin.concurrent.thread

/**
 * 뷰가 화면에 보이는 자리의 픽셀을 창에서 그대로 복사해 PNG base64 로 준다.
 * 뷰를 다시 그리는 캡처(view.draw)는 Skia Canvas 같은 TextureView 를 클립·투명도 없이 맨 위에 덧그려 화면과 달라진다.
 */
class ViewPixelCopyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ViewPixelCopy")

    AsyncFunction("capture") { viewTag: Int, promise: Promise ->
      val view = appContext.findView<View>(viewTag)
      val window = appContext.currentActivity?.window
      val rect = Rect()
      if (view == null || window == null || !view.getGlobalVisibleRect(rect) || rect.isEmpty) {
        promise.reject("ERR_VIEW_NOT_VISIBLE", "view $viewTag is not on screen", null)
        return@AsyncFunction
      }
      val bitmap = Bitmap.createBitmap(rect.width(), rect.height(), Bitmap.Config.ARGB_8888)
      PixelCopy.request(window, rect, bitmap, { result ->
        if (result != PixelCopy.SUCCESS) {
          bitmap.recycle()
          promise.reject("ERR_PIXEL_COPY", "PixelCopy failed: $result", null)
          return@request
        }
        thread {
          val out = ByteArrayOutputStream()
          bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
          bitmap.recycle()
          promise.resolve(Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP))
        }
      }, Handler(Looper.getMainLooper()))
    }.runOnQueue(Queues.MAIN)
  }
}
