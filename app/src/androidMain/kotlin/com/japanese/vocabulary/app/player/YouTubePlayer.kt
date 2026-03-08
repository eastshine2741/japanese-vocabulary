package com.japanese.vocabulary.app.player

import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

@Composable
actual fun YouTubePlayer(videoId: String, modifier: Modifier, onSecondChanged: (Float) -> Unit) {
    val callbackRef = rememberUpdatedState(onSecondChanged)

    AndroidView(
        factory = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                CookieManager.getInstance().setAcceptCookie(true)

                addJavascriptInterface(object {
                    @JavascriptInterface
                    fun onTimeUpdate(second: Double) {
                        callbackRef.value(second.toFloat())
                    }
                }, "Android")

                webChromeClient = WebChromeClient()

                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        view?.evaluateJavascript(
                            """
                            (function() {
                                function poll() {
                                    var v = document.querySelector('video');
                                    if (v) Android.onTimeUpdate(v.currentTime);
                                    setTimeout(poll, 500);
                                }
                                poll();
                            })();
                            """.trimIndent(),
                            null
                        )
                    }
                }

                loadUrl(
                    "https://www.youtube-nocookie.com/embed/$videoId" +
                    "?autoplay=1&playsinline=1&rel=0"
                )
            }
        },
        modifier = modifier
    )
}
