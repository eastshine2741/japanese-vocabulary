import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors } from '../theme/theme';

interface Props {
  currentMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SeekBar({ currentMs, durationMs, onSeek }: Props) {
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekDisplayMs, setSeekDisplayMs] = useState(0);

  const trackWidthSV = useSharedValue(0);
  const playbackProgress = useSharedValue(0); // JS thread writes here (playback)
  const seekProgress = useSharedValue(0);     // UI thread writes here (gesture)
  const isSeekingSV = useSharedValue(0);       // UI thread flag

  const progress = durationMs > 0 ? currentMs / durationMs : 0;

  // Sync playback position (JS thread only writes to playbackProgress)
  useEffect(() => {
    playbackProgress.value = progress;
  }, [progress]);

  // UI thread picks which value to use — no race condition
  const effectiveProgress = useDerivedValue(() => {
    return isSeekingSV.value ? seekProgress.value : playbackProgress.value;
  });

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidthSV.value = e.nativeEvent.layout.width;
  }, []);

  const onSeekStart = useCallback(() => setIsSeeking(true), []);
  const onSeekEnd = useCallback((fraction: number) => {
    setIsSeeking(false);
    onSeek(fraction * durationMs);
  }, [durationMs, onSeek]);
  const onSeekUpdate = useCallback((ms: number) => setSeekDisplayMs(ms), []);

  const gesture = useMemo(() =>
    Gesture.Pan()
      .manualActivation(true)
      .onTouchesDown((e, mgr) => {
        mgr.activate();
      })
      .onBegin((e) => {
        'worklet';
        if (trackWidthSV.value <= 0) return;
        const fraction = Math.max(0, Math.min(1, e.x / trackWidthSV.value));
        isSeekingSV.value = 1;
        seekProgress.value = fraction;
        runOnJS(onSeekStart)();
        runOnJS(onSeekUpdate)(fraction * durationMs);
      })
      .onUpdate((e) => {
        'worklet';
        if (trackWidthSV.value <= 0) return;
        const fraction = Math.max(0, Math.min(1, e.x / trackWidthSV.value));
        seekProgress.value = fraction;
        runOnJS(onSeekUpdate)(fraction * durationMs);
      })
      .onEnd(() => {
        'worklet';
        runOnJS(onSeekEnd)(seekProgress.value);
        isSeekingSV.value = 0;
      })
      .onFinalize(() => {
        'worklet';
        isSeekingSV.value = 0;
      })
      .minPointers(1)
      .maxPointers(1),
  [durationMs, onSeekStart, onSeekEnd, onSeekUpdate]);

  const trackAnimStyle = useAnimatedStyle(() => ({
    height: isSeekingSV.value ? 4 : 2,
  }));

  const fillAnimStyle = useAnimatedStyle(() => ({
    height: isSeekingSV.value ? 4 : 2,
    width: effectiveProgress.value * trackWidthSV.value,
  }));

  const thumbAnimStyle = useAnimatedStyle(() => ({
    opacity: isSeekingSV.value,
    left: effectiveProgress.value * trackWidthSV.value - 8,
  }));

  const tooltipAnimStyle = useAnimatedStyle(() => ({
    opacity: isSeekingSV.value,
    left: Math.max(0, Math.min(
      effectiveProgress.value * trackWidthSV.value - 20,
      trackWidthSV.value - 50,
    )),
  }));

  const displayMs = isSeeking ? seekDisplayMs : currentMs;

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={styles.touchArea}
          onLayout={handleLayout}
        >
          <Animated.View style={[styles.tooltipWrap, tooltipAnimStyle]}>
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>{formatTime(seekDisplayMs)}</Text>
            </View>
            <View style={styles.tooltipArrow} />
          </Animated.View>
          <Animated.View style={[styles.track, trackAnimStyle]}>
            <Animated.View style={[styles.fill, fillAnimStyle]} />
          </Animated.View>
          <Animated.View style={[styles.thumb, thumbAnimStyle]} />
        </Animated.View>
      </GestureDetector>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(displayMs)}</Text>
        <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    paddingTop: 36,
    marginTop: -36,
    justifyContent: 'flex-end',
  },
  track: {
    backgroundColor: Colors.border,
  },
  fill: {
    backgroundColor: Colors.primary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  thumb: {
    position: 'absolute',
    bottom: -7,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  tooltipWrap: {
    position: 'absolute',
    bottom: 10,
    alignItems: 'center',
  },
  tooltip: {
    backgroundColor: '#1A1A1AEE',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1A1A1AEE',
  },
});
