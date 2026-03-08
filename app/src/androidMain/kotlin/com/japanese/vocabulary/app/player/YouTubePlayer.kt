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
                webViewClient = WebViewClient()

                val html = """
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1">
                      <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { background: #000; width: 100%; height: 100vh; overflow: hidden; }
                        #player { width: 100%; height: 100%; }
                      </style>
                    </head>
                    <body>
                      <div id="player"></div>
                      <script src="https://www.youtube.com/iframe_api"></script>
                      <script>
                        var player;
                        var timer;
                        function onYouTubeIframeAPIReady() {
                          player = new YT.Player('player', {
                            videoId: '$videoId',
                            playerVars: {
                              autoplay: 1,
                              playsinline: 1,
                              rel: 0,
                              modestbranding: 1
                            },
                            events: {
                              onReady: function(e) {
                                e.target.playVideo();
                                timer = setInterval(function() {
                                  if (player && player.getCurrentTime) {
                                    Android.onTimeUpdate(player.getCurrentTime());
                                  }
                                }, 500);
                              }
                            }
                          });
                        }
                      </script>
                    </body>
                    </html>
                """.trimIndent()

                loadDataWithBaseURL(
                    "https://www.youtube.com",
                    html,
                    "text/html",
                    "UTF-8",
                    null
                )
            }
        },
        modifier = modifier
    )
}
