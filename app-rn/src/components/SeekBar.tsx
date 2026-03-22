import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
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
  const [seekFraction, setSeekFraction] = useState(0);
  const trackWidth = useRef(0);

  const progress = durationMs > 0 ? currentMs / durationMs : 0;
  const displayProgress = isSeeking ? seekFraction : progress;
  const displayMs = isSeeking ? seekFraction * durationMs : currentMs;
  const thumbLeft = displayProgress * trackWidth.current - 8;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  }, []);

  const handleGrant = useCallback((e: GestureResponderEvent) => {
    const fraction = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth.current));
    setSeekFraction(fraction);
    setIsSeeking(true);
  }, []);

  const handleMove = useCallback((e: GestureResponderEvent) => {
    const fraction = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth.current));
    setSeekFraction(fraction);
  }, []);

  const handleRelease = useCallback(() => {
    setIsSeeking(false);
    onSeek(seekFraction * durationMs);
  }, [seekFraction, durationMs, onSeek]);

  return (
    <View>
      <View
        style={styles.touchArea}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleGrant}
        onResponderMove={handleMove}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleRelease}
        onLayout={handleLayout}
      >
        {isSeeking && trackWidth.current > 0 && (
          <View style={[styles.tooltipWrap, { left: Math.max(0, Math.min(thumbLeft - 12, trackWidth.current - 50)) }]}>
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>{formatTime(seekFraction * durationMs)}</Text>
            </View>
            <View style={styles.tooltipArrow} />
          </View>
        )}
        <View style={[styles.track, isSeeking && styles.trackSeeking]}>
          <View style={[styles.fill, { width: `${displayProgress * 100}%` }, isSeeking && styles.fillSeeking]} />
        </View>
        {isSeeking && trackWidth.current > 0 && (
          <View style={[styles.thumb, { left: thumbLeft }]} />
        )}
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(displayMs)}</Text>
        <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    paddingTop: 30,
    marginTop: -30,
    justifyContent: 'flex-end',
  },
  track: {
    height: 2,
    backgroundColor: Colors.border,
  },
  trackSeeking: {
    height: 4,
  },
  fill: {
    height: 2,
    backgroundColor: Colors.primary,
  },
  fillSeeking: {
    height: 4,
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
