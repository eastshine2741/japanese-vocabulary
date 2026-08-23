import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import YouTubePlayer, { YouTubePlayerRef } from '../YouTubePlayer';
import { Colors } from '../../theme/theme';

export const SONG_DETAIL_MV_BAR_HEIGHT = 56;

export interface SongDetailMvBarProps {
  title: string;
  artist: string;
  youtubeUrl?: string | null;
  videoId?: string | null;
  initialSeekMs?: number;
  currentTimeMs?: number;
  durationMs?: number;
  autoplay?: boolean;
  muted?: boolean;
  bottomInset?: number;
  zIndex?: number;
  embedded?: boolean;
  style?: ViewStyle;
  onCurrentTimeChange?: (currentTimeMs: number) => void;
  onDurationChange?: (durationMs: number) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  onBarPress?: () => void;
}

export interface SongDetailMvBarRef {
  seekToMs: (milliseconds: number) => void;
}

function extractVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

function formatTime(ms: number): string {
  const safeSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const SongDetailMvBarComponent = forwardRef<SongDetailMvBarRef, SongDetailMvBarProps>(function SongDetailMvBarComponent({
  title,
  artist,
  youtubeUrl,
  videoId,
  initialSeekMs,
  currentTimeMs,
  durationMs,
  autoplay = true,
  muted = false,
  bottomInset,
  zIndex = 10,
  embedded = false,
  style,
  onCurrentTimeChange,
  onDurationChange,
  onPlayingChange,
  onBarPress,
}, ref) {
  const insets = useSafeAreaInsets();
  const playerRef = useRef<YouTubePlayerRef>(null);
  const initialSeekDoneRef = useRef(false);
  const pendingSeekMsRef = useRef<number | null>(null);
  const resolvedVideoId = useMemo(
    () => videoId ?? extractVideoId(youtubeUrl),
    [videoId, youtubeUrl],
  );

  const [internalCurrentMs, setInternalCurrentMs] = useState(0);
  const [internalDurationMs, setInternalDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoplay);

  const effectiveCurrentMs = currentTimeMs ?? internalCurrentMs;
  const effectiveDurationMs = durationMs ?? internalDurationMs;
  const safeBottomInset = bottomInset ?? insets.bottom;

  const handleTimeChange = useCallback((seconds: number) => {
    const nextMs = Math.round(seconds * 1000);
    setInternalCurrentMs(nextMs);
    onCurrentTimeChange?.(nextMs);
  }, [onCurrentTimeChange]);

  const applySeekToMs = useCallback((milliseconds: number) => {
    const nextMs = Math.max(0, milliseconds);
    playerRef.current?.seekTo(nextMs / 1000);
    setInternalCurrentMs(nextMs);
    onCurrentTimeChange?.(nextMs);
  }, [onCurrentTimeChange]);

  const handleDurationChange = useCallback((seconds: number) => {
    const nextMs = Math.round(seconds * 1000);
    setInternalDurationMs(nextMs);
    onDurationChange?.(nextMs);
    if (seconds <= 0) return;
    if (pendingSeekMsRef.current != null) {
      const pendingSeekMs = pendingSeekMsRef.current;
      pendingSeekMsRef.current = null;
      initialSeekDoneRef.current = true;
      applySeekToMs(pendingSeekMs);
      return;
    }
    if (initialSeekMs != null && !initialSeekDoneRef.current) {
      initialSeekDoneRef.current = true;
      applySeekToMs(initialSeekMs);
    }
  }, [applySeekToMs, initialSeekMs, onDurationChange]);

  const handleStateChange = useCallback((state: string) => {
    const nextPlaying = state === 'playing' || state === 'buffering';
    setIsPlaying(nextPlaying);
    onPlayingChange?.(nextPlaying);
  }, [onPlayingChange]);

  const seekToMs = useCallback((milliseconds: number) => {
    const nextMs = Math.max(0, milliseconds);
    if (effectiveDurationMs <= 0) {
      pendingSeekMsRef.current = nextMs;
    }
    applySeekToMs(nextMs);
  }, [applySeekToMs, effectiveDurationMs]);

  useImperativeHandle(ref, () => ({ seekToMs }), [seekToMs]);

  const handleTogglePlayback = useCallback(() => {
    if (isPlaying) {
      playerRef.current?.pause();
      setIsPlaying(false);
      onPlayingChange?.(false);
    } else {
      playerRef.current?.play();
      setIsPlaying(true);
      onPlayingChange?.(true);
    }
  }, [isPlaying, onPlayingChange]);

  const bar = (
    <View style={[styles.bar, embedded && styles.embeddedBar, embedded && style]}>
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.pressArea}
          onPress={onBarPress}
          disabled={onBarPress == null}
          activeOpacity={0.9}
          accessibilityRole={onBarPress ? 'button' : undefined}
          accessibilityLabel={onBarPress ? '재생 중 단어 패널 전환' : undefined}
        >
          <View pointerEvents="none" style={styles.mvThumb}>
            {resolvedVideoId ? (
              <YouTubePlayer
                ref={playerRef}
                videoId={resolvedVideoId}
                height={30}
                autoplay={autoplay}
                muted={muted}
                lowestQuality
                onTimeChange={handleTimeChange}
                onDurationChange={handleDurationChange}
                onStateChange={handleStateChange}
              />
            ) : (
              <View style={styles.thumbFallback}>
                <Feather name="play" size={12} color="#FFFFFF" />
              </View>
            )}
          </View>

          <View style={styles.textCol}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.artist} numberOfLines={1}>
              {artist}
              {effectiveDurationMs > 0 ? ` · ${formatTime(effectiveCurrentMs)} / ${formatTime(effectiveDurationMs)}` : ''}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggle}
          onPress={handleTogglePlayback}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'MV 일시정지' : 'MV 재생'}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={22}
            color={Colors.primary}
            style={!isPlaying && styles.playIcon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (embedded) {
    return bar;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.positioner,
        { paddingBottom: safeBottomInset, zIndex, elevation: zIndex },
        style,
      ]}
    >
      {bar}
    </View>
  );
});

export const SongDetailMvBar = React.memo(SongDetailMvBarComponent);

const styles = StyleSheet.create({
  positioner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    minHeight: SONG_DETAIL_MV_BAR_HEIGHT,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  embeddedBar: {
    width: '100%',
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  content: {
    height: SONG_DETAIL_MV_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  pressArea: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mvThumb: {
    width: 60,
    height: 30,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF33',
  },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  artist: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  toggle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  playIcon: {
    marginLeft: 2,
  },
});
