import React, { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// Match KMP library: origin = "https://${packageName}"
const APP_ORIGIN = 'https://com.anonymous.apprn';

export interface YouTubePlayerRef {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  setPlaybackRate: (rate: number) => void;
  mute: () => void;
  unMute: () => void;
}

interface Props {
  videoId: string;
  height?: number;
  // Start playback automatically once the player is ready. Defaults to true,
  // matching the prior behavior (onReady → loadVideoById, which auto-plays).
  autoplay?: boolean;
  // Start muted. Defaults to false. Muted autoplay is always permitted by the
  // platform, so the Spotlight hero passes muted + autoplay.
  muted?: boolean;
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
function buildPlayerHTML(videoId: string, autoplay: boolean, muted: boolean): string {
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
            ${muted ? 'event.target.mute();' : ''}
            ${autoplay ? `loadVideo('${videoId}', 0);` : `player.cueVideoById('${videoId}', 0);`}
          },
          onStateChange: function(event) { sendPlayerStateChange(event.data); },
          onError: function(error) { sendMessage('error', { code: error.data }); }
        },
        playerVars: {
          autoplay: 0,
          mute: ${muted ? 1 : 0},
          controls: 0,
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

const YouTubePlayer = forwardRef<YouTubePlayerRef, Props>(({
  videoId,
  height,
  autoplay = true,
  muted = false,
  onTimeChange,
  onDurationChange,
  onStateChange,
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const html = buildPlayerHTML(videoId, autoplay, muted);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      webViewRef.current?.injectJavaScript(`player.seekTo(${seconds}, true); true;`);
    },
    play: () => {
      webViewRef.current?.injectJavaScript(`player.playVideo(); true;`);
    },
    pause: () => {
      webViewRef.current?.injectJavaScript(`player.pauseVideo(); true;`);
    },
    setPlaybackRate: (rate: number) => {
      webViewRef.current?.injectJavaScript(`player.setPlaybackRate(${rate}); true;`);
    },
    mute: () => {
      webViewRef.current?.injectJavaScript(`player.mute(); true;`);
    },
    unMute: () => {
      webViewRef.current?.injectJavaScript(`player.unMute(); true;`);
    },
  }));

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
    <View style={[styles.container, height != null ? { height } : { flex: 1 }]}>
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
});

// Memoize: PlayerScreen re-renders ~10×/s on currentMs ticks; without this
// the WebView wrapper reconciles every tick even though its props are stable.
export default React.memo(YouTubePlayer);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});
