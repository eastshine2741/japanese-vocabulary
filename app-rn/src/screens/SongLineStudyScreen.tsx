import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather, Ionicons } from '@expo/vector-icons';
import YouTubePlayer, { YouTubePlayerRef } from '../components/YouTubePlayer';
import { Button } from '../components/ui';
import { buildStudyLines, firstLockedPosition, isWordSeen, lineWordKeys, StudyLine } from '../components/lineStudy/studyLines';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSongDetailStore } from '../stores/songDetailStore';
import { Colors } from '../theme/theme';
import { Typography } from '../theme/typography';
import type { WordInSongItemDto } from '../types/song';
import { extractYoutubeVideoId } from '../utils/youtube';

type Props = NativeStackScreenProps<RootStackParamList, 'SongLineStudy'>;

const LINE_MOTION_MS = 320;
const REVEAL_MOTION_MS = 450;

/**
 * 가사를 한 줄씩 듣고 그 줄의 단어를 풀면 번역이 열린다. 단어 → 가사가 아니라 가사 → 단어 순서로 공부하게 한다.
 * 한 화면의 가사는 지금 줄과 바로 앞 줄뿐이다. MV 는 막지 않고, 단어를 다 아는 줄은 멈추지 않고 흘려보낸다.
 */
export default function SongLineStudyScreen({ navigation, route }: Props) {
  const { songId } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const data = useSongDetailStore(s => (s.songId === songId ? s.data : null));
  const tiers = useSongDetailStore(s => (s.songId === songId ? s.tiers : null));
  const load = useSongDetailStore(s => s.load);
  const refreshWords = useSongDetailStore(s => s.refreshWords);

  useEffect(() => {
    if (useSongDetailStore.getState().songId !== songId) load(songId);
  }, [load, songId]);

  const studyLines = useMemo(() => (data == null || tiers == null
    ? null
    : buildStudyLines(data.lyrics.lines, data.words.words, data.words.lineWordIndexes, tiers.tiers)
  ), [data, tiers]);

  const [position, setPosition] = useState<number | null>(null);
  const studyLinesRef = useRef(studyLines);
  studyLinesRef.current = studyLines;
  const positionRef = useRef(position);
  positionRef.current = position;

  const current = position != null ? studyLines?.[position] ?? null : null;
  const previous = position != null && position > 0 ? studyLines?.[position - 1] ?? null : null;
  const openedCount = studyLines?.filter(line => line.unseenCount === 0).length ?? 0;
  const isLast = studyLines != null && position === studyLines.length - 1;

  const playerRef = useRef<YouTubePlayerRef>(null);
  const playerReadyRef = useRef(false);
  const pendingClipRef = useRef<StudyLine | null>(null);
  // 재생 시각을 따라 줄을 넘기는 중인지. 잠긴 줄 끝에서 멈춘 뒤 유저가 MV 를 직접 이어 틀면 따라가지 않는다.
  const followingRef = useRef(false);
  // seek 직후에도 직전 위치의 시각이 한두 번 더 온다. 그 값으로 줄을 넘기지 않게 목표 근처 시각이 올 때까지 무시한다.
  const seekTargetMsRef = useRef<number | null>(null);
  const videoId = useMemo(() => extractYoutubeVideoId(data?.song.youtubeUrl), [data?.song.youtubeUrl]);

  const playClip = useCallback((line: StudyLine) => {
    if (line.clipStartMs == null) return;
    if (!playerReadyRef.current) {
      pendingClipRef.current = line;
      return;
    }
    followingRef.current = true;
    seekTargetMsRef.current = line.clipStartMs;
    playerRef.current?.seekTo(line.clipStartMs / 1000);
    playerRef.current?.play();
  }, []);

  useEffect(() => {
    if (position != null || studyLines == null || studyLines.length === 0) return;
    const first = firstLockedPosition(studyLines);
    setPosition(first);
    playClip(studyLines[first]);
  }, [playClip, position, studyLines]);

  // cueVideo 가 끝나야 seekTo 가 먹는다. 첫 상태 메시지가 그 신호다.
  const handleStateChange = useCallback(() => {
    if (playerReadyRef.current) return;
    playerReadyRef.current = true;
    const pending = pendingClipRef.current;
    pendingClipRef.current = null;
    if (pending != null) playClip(pending);
  }, [playClip]);

  // 잠긴 줄은 끝에서 멈추고, 열린 줄은 멈추지 않고 다음 줄이 시작되는 시각에 화면만 넘긴다.
  const handleTimeChange = useCallback((seconds: number) => {
    const lines = studyLinesRef.current;
    const pos = positionRef.current;
    if (!followingRef.current || lines == null || pos == null) return;
    const ms = seconds * 1000;
    const target = seekTargetMsRef.current;
    if (target != null) {
      if (Math.abs(ms - target) > 1500) return;
      seekTargetMsRef.current = null;
    }
    const line = lines[pos];
    if (line.unseenCount > 0) {
      if (line.clipEndMs != null && ms >= line.clipEndMs) {
        followingRef.current = false;
        playerRef.current?.pause();
      }
      return;
    }
    const next = lines[pos + 1];
    if (next?.clipStartMs != null && ms >= next.clipStartMs) {
      positionRef.current = pos + 1;
      setPosition(pos + 1);
    }
  }, []);

  // 풀러 갔던 줄이 열려서 돌아오면 같은 구간을 다시 들려준다 — 이번엔 뜻이 붙은 채로.
  const solvingLineRef = useRef<number | null>(null);
  useEffect(() => {
    if (current == null || solvingLineRef.current !== current.line.index || current.unseenCount > 0) return;
    solvingLineRef.current = null;
    playClip(current);
  }, [current, playClip]);

  const isInitialFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isInitialFocusRef.current) {
        isInitialFocusRef.current = false;
        return;
      }
      refreshWords(songId).catch(() => undefined);
    }, [refreshWords, songId]),
  );

  const solveLine = useCallback(() => {
    if (current == null || data == null) return;
    playerRef.current?.pause();
    followingRef.current = false;
    solvingLineRef.current = current.line.index;
    navigation.navigate('SongReview', {
      origin: 'SongDetail',
      trigger: 'line',
      source: {
        deckId: null,
        songId,
        title: data.song.title,
        artist: data.song.artist,
        artworkUrl: data.song.artworkUrl,
        dueCount: current.unseenCount,
        totalCount: current.unseenCount,
        lineWords: lineWordKeys(current),
      },
    });
  }, [current, data, navigation, songId]);

  const goNext = useCallback(() => {
    const nextPosition = position != null ? position + 1 : null;
    const next = nextPosition != null ? studyLines?.[nextPosition] : null;
    if (nextPosition == null || next == null) {
      navigation.goBack();
      return;
    }
    setPosition(nextPosition);
    playClip(next);
  }, [navigation, playClip, position, studyLines]);

  const replay = useCallback(() => {
    if (current != null) playClip(current);
  }, [current, playClip]);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const opened = current != null && current.unseenCount === 0;
  const canReplay = current?.clipStartMs != null && videoId != null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
          <Feather name="chevron-left" size={26} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{data?.song.title ?? ''}</Text>
        <Text style={styles.headerCount}>
          {studyLines != null ? `${openedCount}/${studyLines.length}줄` : ''}
        </Text>
      </View>

      {videoId != null && (
        <View style={[styles.video, { height: Math.round(width * 9 / 16) }]}>
          <YouTubePlayer
            ref={playerRef}
            videoId={videoId}
            autoplay={false}
            onStateChange={handleStateChange}
            onTimeChange={handleTimeChange}
          />
        </View>
      )}

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {previous != null && (
          <Animated.View key={previous.line.index} entering={FadeIn.duration(LINE_MOTION_MS)} style={styles.previous}>
            <Text style={styles.previousText}>{previous.line.originalText}</Text>
            {previous.unseenCount === 0 && previous.line.koreanLyrics != null && (
              <Text style={styles.previousTranslation}>{previous.line.koreanLyrics}</Text>
            )}
          </Animated.View>
        )}

        {current != null && (
          <Animated.View key={current.line.index} entering={FadeInUp.duration(LINE_MOTION_MS)}>
            <Text style={styles.lineText}>{current.line.originalText}</Text>
            {current.line.koreanLyrics != null && (opened ? (
              <Animated.Text entering={FadeIn.duration(REVEAL_MOTION_MS)} style={styles.translation}>
                {current.line.koreanLyrics}
              </Animated.Text>
            ) : (
              // 비어 있는 막대는 로딩처럼 보여서, 잠긴 칸은 자물쇠와 점선 테두리로 그린다.
              <View style={styles.translationLocked}>
                <Ionicons name="lock-closed" size={14} color="#FFFFFF66" />
                <Text style={styles.translationLockedLabel}>모르는 단어를 풀면 번역이 열려요</Text>
              </View>
            ))}
            {current.words.length > 0 && (
              <View style={styles.words}>
                {current.words.map(word => <LineWordRow key={word.japanese} word={word} />)}
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {current != null && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {canReplay && (
            <Pressable
              onPress={replay}
              style={styles.replay}
              accessibilityRole="button"
              accessibilityLabel="이 줄 다시 듣기"
            >
              <Ionicons name="play-back" size={20} color="#FFFFFF" />
            </Pressable>
          )}
          <Button
            style={styles.primary}
            size="lg"
            label={opened ? (isLast ? '곡으로 돌아가기' : '다음 줄') : `단어 ${current.unseenCount}개 풀기`}
            onPress={opened ? goNext : solveLine}
          />
        </View>
      )}
    </View>
  );
}

/** 누를 수 있는 칩처럼 보이지 않게 테두리 없는 행으로 둔다. 안 본 단어는 뜻 자리에 자물쇠만 둔다. */
const LineWordRow = React.memo(function LineWordRow({ word }: { word: WordInSongItemDto }) {
  const seen = isWordSeen(word);
  return (
    <View style={styles.wordRow}>
      <Ionicons
        name={seen ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={seen ? Colors.primary : '#FFFFFF4D'}
      />
      <Text style={[styles.wordText, !seen && styles.wordTextUnseen]} numberOfLines={1}>
        {word.surface}
        {word.reading != null && word.reading !== word.surface && (
          <Text style={styles.wordReading}>{`  ${word.reading}`}</Text>
        )}
      </Text>
      {seen ? (
        <Animated.Text entering={FadeIn.duration(REVEAL_MOTION_MS)} style={styles.wordMeaning} numberOfLines={1}>
          {word.koreanText ?? ''}
        </Animated.Text>
      ) : (
        <Ionicons name="lock-closed" size={13} color="#FFFFFF4D" style={styles.wordMeaningLocked} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#14181C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  headerTitle: {
    ...Typography.bodySemiBold,
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  headerCount: {
    ...Typography.bodyMedium,
    color: '#FFFFFF99',
    fontSize: 14,
  },
  video: {
    backgroundColor: '#000000',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  previous: {
    gap: 4,
    marginBottom: 28,
  },
  previousText: {
    ...Typography.body,
    color: '#FFFFFF66',
    fontSize: 15,
  },
  previousTranslation: {
    ...Typography.body,
    color: '#FFFFFF4D',
    fontSize: 13,
  },
  lineText: {
    ...Typography.headingBold,
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 36,
  },
  translation: {
    ...Typography.bodyMedium,
    color: '#FFFFFFCC',
    fontSize: 17,
    lineHeight: 25,
    marginTop: 10,
  },
  translationLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#FFFFFF33',
  },
  translationLockedLabel: {
    ...Typography.bodyMedium,
    color: '#FFFFFF66',
    fontSize: 14,
  },
  words: {
    gap: 4,
    marginTop: 24,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  wordText: {
    ...Typography.bodySemiBold,
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  wordTextUnseen: {
    color: '#FFFFFF99',
  },
  wordReading: {
    ...Typography.body,
    color: '#FFFFFF66',
    fontSize: 12,
  },
  wordMeaning: {
    ...Typography.body,
    flex: 1,
    textAlign: 'right',
    color: '#FFFFFFB3',
    fontSize: 14,
  },
  wordMeaningLocked: {
    marginLeft: 'auto',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  replay: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF1F',
  },
  primary: {
    flex: 1,
  },
});
