import React, { useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// Match KMP library: origin = "https://${packageName}"
const APP_ORIGIN = 'https://com.anonymous.apprn';

interface Props {
  videoId: string;
  height: number;
  onTimeChange?: (seconds: number) => void;
  onDurationChange?: (seconds: number) => void;
  onStateChange?: (state: string) => void;
}

/**
 * HTML template matching the KMP library (pierfrancescosoffritti/android-youtube-player).
 * Key details replicated from ayp_youtube_player.html:
 * - <script defer> for IFrame API (avoids race condition)
 * - playerVars match IFramePlayerOptions defaults + controls:1, rel:0
 * - origin set to app package name (not youtube.com)
 * - loadVideoById called from a JS function invoked after ready
 */
function buildPlayerHTML(videoId: string): string {
  return `<!DOCTYPE html>
<html>
  <style type="text/css">
    html, body {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background-color: #000000;
      overflow: hidden;
      position: fixed;
    }
  </style>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <script defer src="https://www.youtube.com/iframe_api"></script>
  </head>
  <body>
    <div id="youTubePlayerDOM"></div>
  </body>
  <script type="text/javascript">
    var player;
    var timerId;

    function onYouTubeIframeAPIReady() {
      player = new YT.Player('youTubePlayerDOM', {
        height: '100%',
        width: '100%',
        events: {
          onReady: function(event) {
            sendMessage('ready', {});
            loadVideo('${videoId}', 0);
          },
          onStateChange: function(event) { sendPlayerStateChange(event.data); },
          onError: function(error) { sendMessage('error', { code: error.data }); }
        },
        playerVars: {
          autoplay: 0,
          mute: 0,
          controls: 1,
          enablejsapi: 1,
          fs: 0,
          origin: '${APP_ORIGIN}',
          rel: 0,
          iv_load_policy: 3,
          cc_load_policy: 0
        }
      });
    }

    function sendPlayerStateChange(playerState) {
      clearTimeout(timerId);

      var stateMap = {};
      stateMap[YT.PlayerState.UNSTARTED] = 'unstarted';
      stateMap[YT.PlayerState.ENDED] = 'ended';
      stateMap[YT.PlayerState.PLAYING] = 'playing';
      stateMap[YT.PlayerState.PAUSED] = 'paused';
      stateMap[YT.PlayerState.BUFFERING] = 'buffering';
      stateMap[YT.PlayerState.CUED] = 'cued';

      var stateName = stateMap[playerState] || 'unknown';
      sendMessage('state', { state: stateName });

      if (playerState === YT.PlayerState.PLAYING) {
        startSendCurrentTimeInterval();
        var duration = player.getDuration();
        sendMessage('duration', { duration: duration });
      }
    }

    function startSendCurrentTimeInterval() {
      timerId = setInterval(function() {
        if (player && player.getCurrentTime) {
          sendMessage('time', { currentTime: player.getCurrentTime() });
        }
      }, 100);
    }

    function loadVideo(videoId, startSeconds) {
      player.loadVideoById(videoId, startSeconds);
    }

    function sendMessage(type, data) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data }));
    }
  </script>
</html>`;
}

export default function YouTubePlayer({
  videoId,
  height,
  onTimeChange,
  onDurationChange,
  onStateChange,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const html = buildPlayerHTML(videoId);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'time') {
        onTimeChange?.(msg.data.currentTime);
      } else if (msg.type === 'duration') {
        onDurationChange?.(msg.data.duration);
      } else if (msg.type === 'state') {
        onStateChange?.(msg.data.state);
      }
    } catch {}
  }, [onTimeChange, onDurationChange, onStateChange]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html, baseUrl: APP_ORIGIN }}
        style={styles.webview}
        originWhitelist={['*']}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
        allowsFullscreenVideo={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});
