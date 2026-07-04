import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import YouTubePlayer, { YouTubePlayerRef } from '../YouTubePlayer';
import { Colors } from '../../theme/theme';

export const SONG_DETAIL_MV_BAR_HEIGHT = 58;

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
  style?: ViewStyle;
  onCurrentTimeChange?: (currentTimeMs: number) => void;
  onDurationChange?: (durationMs: number) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
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

function SongDetailMvBarComponent({
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
  style,
  onCurrentTimeChange,
  onDurationChange,
  onPlayingChange,
}: SongDetailMvBarProps) {
  const insets = useSafeAreaInsets();
  const playerRef = useRef<YouTubePlayerRef>(null);
  const initialSeekDoneRef = useRef(false);
  const resolvedVideoId = useMemo(
    () => videoId ?? extractVideoId(youtubeUrl),
    [videoId, youtubeUrl],
  );

  const [internalCurrentMs, setInternalCurrentMs] = useState(0);
  const [internalDurationMs, setInternalDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoplay);

  const effectiveCurrentMs = currentTimeMs ?? internalCurrentMs;
  const effectiveDurationMs = durationMs ?? internalDurationMs;
  const progress = effectiveDurationMs > 0
    ? Math.min(1, Math.max(0, effectiveCurrentMs / effectiveDurationMs))
    : 0;
  const safeBottomInset = bottomInset ?? insets.bottom;

  const handleTimeChange = useCallback((seconds: number) => {
    const nextMs = Math.round(seconds * 1000);
    setInternalCurrentMs(nextMs);
    onCurrentTimeChange?.(nextMs);
  }, [onCurrentTimeChange]);

  const handleDurationChange = useCallback((seconds: number) => {
    const nextMs = Math.round(seconds * 1000);
    setInternalDurationMs(nextMs);
    onDurationChange?.(nextMs);
    if (initialSeekMs != null && !initialSeekDoneRef.current && seconds > 0) {
      initialSeekDoneRef.current = true;
      playerRef.current?.seekTo(initialSeekMs / 1000);
      setInternalCurrentMs(initialSeekMs);
      onCurrentTimeChange?.(initialSeekMs);
    }
  }, [initialSeekMs, onCurrentTimeChange, onDurationChange]);

  const handleStateChange = useCallback((state: string) => {
    const nextPlaying = state === 'playing' || state === 'buffering';
    setIsPlaying(nextPlaying);
    onPlayingChange?.(nextPlaying);
  }, [onPlayingChange]);

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

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.positioner,
        { paddingBottom: safeBottomInset, zIndex, elevation: zIndex },
        style,
      ]}
    >
      <View style={styles.bar}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.content}>
          <View style={styles.mvThumb}>
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
            <View style={styles.mvBadge}>
              <Text style={styles.mvBadgeText}>MV</Text>
            </View>
          </View>

          <View style={styles.textCol}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.artist} numberOfLines={1}>
              {artist}
              {effectiveDurationMs > 0 ? ` · ${formatTime(effectiveCurrentMs)} / ${formatTime(effectiveDurationMs)}` : ''}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.toggle}
            onPress={handleTogglePlayback}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'MV 일시정지' : 'MV 재생'}
          >
            <Feather name={isPlaying ? 'pause' : 'play'} size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

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
  progressTrack: {
    height: 2,
    backgroundColor: '#D9D9D9',
  },
  progressFill: {
    height: 2,
    backgroundColor: Colors.primary,
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  mvThumb: {
    width: 60,
    height: 30,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#111111',
  },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  mvBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#00000099',
  },
  mvBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFFFFF',
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
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
});
