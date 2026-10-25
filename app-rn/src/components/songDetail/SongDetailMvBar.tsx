import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { SharedValue, interpolateColor, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import YouTubePlayer, { YouTubePlayerRef } from '../YouTubePlayer';
import ReportIcon from '../ReportIcon';
import { Colors } from '../../theme/theme';
import { extractYoutubeVideoId } from '../../utils/youtube';
import type { MvUnavailableReason } from '../../types/song';
import { canWatchOnYoutube, mvBlock, mvBlockLabel } from './mvUnavailable';

export const SONG_DETAIL_MV_BAR_HEIGHT = 56;

export interface SongDetailMvBarProps {
  title: string;
  artist: string;
  youtubeUrl?: string | null;
  videoId?: string | null;
  mvUnavailableReason?: MvUnavailableReason | null;
  initialSeekMs?: number;
  currentTimeMs?: number;
  durationMs?: number;
  autoplay?: boolean;
  muted?: boolean;
  bottomInset?: number;
  zIndex?: number;
  embedded?: boolean;
  /** 시트에 박힌 경우 접힘 0 ↔ 펼침 1. 펼칠수록 어두운 바탕에 맞춰 글자를 희게 바꾼다. */
  expandProgress?: SharedValue<number>;
  style?: ViewStyle;
  onCurrentTimeChange?: (currentTimeMs: number) => void;
  onDurationChange?: (durationMs: number) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  onBarPress?: () => void;
  onReportPress?: () => void;
}

export interface SongDetailMvBarRef {
  seekToMs: (milliseconds: number) => void;
  pause: () => void;
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
  mvUnavailableReason,
  initialSeekMs,
  currentTimeMs,
  durationMs,
  autoplay = true,
  muted = false,
  bottomInset,
  zIndex = 10,
  embedded = false,
  expandProgress,
  style,
  onCurrentTimeChange,
  onDurationChange,
  onPlayingChange,
  onBarPress,
  onReportPress,
}, ref) {
  const insets = useSafeAreaInsets();
  const playerRef = useRef<YouTubePlayerRef>(null);
  const initialSeekDoneRef = useRef(false);
  const pendingSeekMsRef = useRef<number | null>(null);
  const resolvedVideoId = useMemo(
    () => videoId ?? extractYoutubeVideoId(youtubeUrl),
    [videoId, youtubeUrl],
  );

  const [internalCurrentMs, setInternalCurrentMs] = useState(0);
  const [internalDurationMs, setInternalDurationMs] = useState(0);
  const [playerFailed, setPlayerFailed] = useState(false);
  const block = mvBlock(mvUnavailableReason, playerFailed);
  const [isPlaying, setIsPlaying] = useState(autoplay && block == null);

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

  const handlePlayerError = useCallback(() => {
    setPlayerFailed(true);
    setIsPlaying(false);
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  const handleOpenYoutube = useCallback(() => {
    if (youtubeUrl) Linking.openURL(youtubeUrl).catch(() => {});
  }, [youtubeUrl]);

  const seekToMs = useCallback((milliseconds: number) => {
    const nextMs = Math.max(0, milliseconds);
    if (effectiveDurationMs <= 0) {
      pendingSeekMsRef.current = nextMs;
    }
    applySeekToMs(nextMs);
  }, [applySeekToMs, effectiveDurationMs]);

  const pause = useCallback(() => {
    playerRef.current?.pause();
    setIsPlaying(false);
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  useImperativeHandle(ref, () => ({ seekToMs, pause }), [pause, seekToMs]);

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

  const collapsedProgress = useSharedValue(0);
  const progress = expandProgress ?? collapsedProgress;
  const titleColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [Colors.textPrimary, '#FFFFFF']),
  }));
  const artistColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [Colors.textSecondary, '#FFFFFFB8']),
  }));
  const borderColorStyle = useAnimatedStyle(() => ({
    borderTopColor: interpolateColor(progress.value, [0, 1], [Colors.border, '#FFFFFF00']),
  }));
  const lightIconStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const toggleIconName = isPlaying ? 'pause' : 'play';
  const bar = (
    <Animated.View style={[styles.bar, embedded && styles.embeddedBar, embedded && borderColorStyle, embedded && style]}>
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
            {resolvedVideoId && block == null ? (
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
                onError={handlePlayerError}
              />
            ) : (
              <View style={styles.thumbFallback}>
                <Feather name={block != null ? 'video-off' : 'play'} size={12} color="#FFFFFF" />
              </View>
            )}
          </View>

          <View style={styles.textCol}>
            <Animated.Text style={[styles.title, titleColorStyle]} numberOfLines={1}>{title}</Animated.Text>
            <Animated.Text style={[styles.artist, artistColorStyle]} numberOfLines={1}>
              {block != null
                ? mvBlockLabel(block)
                : `${artist}${effectiveDurationMs > 0 ? ` · ${formatTime(effectiveCurrentMs)} / ${formatTime(effectiveDurationMs)}` : ''}`}
            </Animated.Text>
          </View>
        </TouchableOpacity>

        {onReportPress ? (
          <TouchableOpacity
            style={styles.toggle}
            onPress={onReportPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="영상 제보"
          >
            <ReportIcon size={17} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        {block != null ? (
          canWatchOnYoutube(block) && youtubeUrl ? (
            <TouchableOpacity
              style={styles.youtubeLink}
              onPress={handleOpenYoutube}
              activeOpacity={0.75}
              accessibilityRole="link"
            >
              <Text style={styles.youtubeLinkText}>YouTube에서 보기</Text>
            </TouchableOpacity>
          ) : null
        ) : (
        <TouchableOpacity
          style={styles.toggle}
          onPress={handleTogglePlayback}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'MV 일시정지' : 'MV 재생'}
        >
          <Ionicons
            name={toggleIconName}
            size={22}
            color={Colors.primary}
            style={!isPlaying && styles.playIcon}
          />
          {/* 초록 아이콘은 커버 색 바탕에 묻힐 수 있어 펼칠수록 흰 아이콘을 겹친다. */}
          <Animated.View pointerEvents="none" style={[styles.lightIcon, lightIconStyle]}>
            <Ionicons
              name={toggleIconName}
              size={22}
              color="#FFFFFF"
              style={!isPlaying && styles.playIcon}
            />
          </Animated.View>
        </TouchableOpacity>
        )}
      </View>
    </Animated.View>
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
    backgroundColor: 'transparent',
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
  youtubeLink: {
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubeLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  lightIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    marginLeft: 2,
  },
});
