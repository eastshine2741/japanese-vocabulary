import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleProp, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  LayoutAnimationConfig,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import YouTubePlayer, { YouTubePlayerRef } from '../components/YouTubePlayer';
import { Button } from '../components/ui';
import { useArtBackdrop } from '../components/rewardCards/artColors';
import { buildStudyLines, firstLockedPosition, isWordSeen, lastReachablePosition, lineWordKeys, snapLineIndex, StudyLine } from '../components/lineStudy/studyLines';
import { hapticLineTick, hapticTranslationOpened, hapticTranslationWord, hapticUnlock } from '../components/songDetail/lyricsHaptics';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSettingsStore } from '../stores/settingsStore';
import { useSongDetailStore } from '../stores/songDetailStore';
import { Colors } from '../theme/theme';
import { Typography } from '../theme/typography';
import type { WordInSongItemDto } from '../types/song';
import { convertReading } from '../utils/readingConverter';
import { extractYoutubeVideoId } from '../utils/youtube';

type Props = NativeStackScreenProps<RootStackParamList, 'SongLineStudy'>;

const FALLBACK_BACKDROP: [string, string] = ['#2A2A31', '#141418'];
const REVEAL_MOTION_MS = 450;
/** 곡 상세 가사 다이얼과 같은 스프링 — 살짝 지나쳤다 돌아와 앉는다. */
const LINE_SPRING = { damping: 22, stiffness: 170, mass: 1 };
/** 지금 줄의 윗변이 가사 영역 위에서 이만큼 아래에 앉는다. 바로 앞 줄이 그 위로 흐리게 보인다. */
const FOCUS_TOP = 84;
/** 줄 사이 거리를 셀 때 한 줄로 치는 높이. 번역이 붙은 줄은 1.x 줄로 센다. */
const LINE_PITCH = 64;
/** 아직 안 온 줄 쪽으로 끌면 이 높이에 다가갈수록 덜 따라온다. 놓으면 지금 줄로 돌아온다. */
const RUBBER_LIMIT = 120;
/** 단어가 많은 줄에서도 가사가 남게 단어 칸은 4줄 반까지만 펼친다. 반쯤 잘린 줄이 스크롤된다는 걸 보여준다. */
const WORDS_MAX_HEIGHT = 154;
/** 지금 줄에서 멀어질수록 흐려진다. 마지막 값이 그 너머 전부. */
const DISTANCE_OPACITY = [1, 0.4, 0.22, 0.12];
const DISTANCE_STEPS = DISTANCE_OPACITY.map((_, i) => i);
const RIPPLE_MS = 1800;
/** 파장이 버튼 밖으로 번지는 최대 폭. */
const RIPPLE_SPREAD = 22;
/** 첫 파장이 터질 때 버튼이 이만큼 부풀었다 돌아온다. */
const CTA_PULSE_SCALE = 1.04;
/** 복습에서 돌아와 화면이 다 앉은 뒤에 풀리게, 잠긴 칸을 잠깐 보여 주고 시작한다. */
const UNLOCK_START_MS = 250;
const UNLOCK_POP_MS = 150;
const UNLOCK_FILL_MS = 250;
/** 어절이 차례로 떠오르는 간격. 긴 번역도 이 안에 다 차게 간격을 좁힌다. */
const UNLOCK_WORD_STAGGER_MS = 55;
const UNLOCK_WORDS_MAX_MS = 440;

/**
 * 가사를 한 줄씩 듣고 그 줄의 단어를 풀면 번역이 열린다. 단어 → 가사가 아니라 가사 → 단어 순서로 공부하게 한다.
 * 지금 줄 둘레만 또렷하고 멀어질수록 흐려진다. MV 는 막지 않고, 단어를 다 아는 줄은 멈추지 않고 흘려보낸다.
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
  // 지나온 줄로 돌아가 들어도 가장 멀리 간 줄은 남는다. 거기까지는 번역이 보이고 자유롭게 오갈 수 있다.
  const furthestRef = useRef<number | null>(null);
  if (position != null && (furthestRef.current == null || position > furthestRef.current)) furthestRef.current = position;
  const furthest = furthestRef.current;

  const current = position != null ? studyLines?.[position] ?? null : null;
  const openedCount = studyLines?.filter(line => line.unseenCount === 0).length ?? 0;
  const isLast = studyLines != null && position === studyLines.length - 1;

  const playerRef = useRef<YouTubePlayerRef>(null);
  const playerReadyRef = useRef(false);
  const pendingClipRef = useRef<StudyLine | null>(null);
  // 재생 시각을 따라 줄을 넘기는 중인지. 잠긴 줄 끝에서 멈춘 뒤 유저가 MV 를 직접 이어 틀면 따라가지 않는다.
  const followingRef = useRef(false);
  // seek 직후에도 직전 위치의 시각이 한두 번 더 온다. 그 값으로 줄을 넘기지 않게 목표 근처 시각이 올 때까지 무시한다.
  const seekTargetMsRef = useRef<number | null>(null);
  const staleTicksRef = useRef(0);
  const videoId = useMemo(() => extractYoutubeVideoId(data?.song.youtubeUrl), [data?.song.youtubeUrl]);
  // 플레이어 마운트 때 고정되는 첫 줄. 재생 전 seek 는 모바일 iframe 이 가끔 버려서, 첫 줄은 시작 위치를 실어 바로 load 한다.
  const [entryClip, setEntryClip] = useState<StudyLine | null>(null);

  const playClip = useCallback((line: StudyLine) => {
    if (line.clipStartMs == null) return;
    if (!playerReadyRef.current) {
      pendingClipRef.current = line;
      return;
    }
    followingRef.current = true;
    seekTargetMsRef.current = line.clipStartMs;
    staleTicksRef.current = 0;
    playerRef.current?.seekTo(line.clipStartMs / 1000);
    playerRef.current?.play();
  }, []);

  useEffect(() => {
    if (position != null || studyLines == null || studyLines.length === 0) return;
    const firstPosition = firstLockedPosition(studyLines);
    const first = studyLines[firstPosition];
    setPosition(firstPosition);
    setEntryClip(first);
    if (first.clipStartMs == null) return;
    followingRef.current = true;
    seekTargetMsRef.current = first.clipStartMs;
    staleTicksRef.current = 0;
  }, [position, studyLines]);

  // 첫 상태 메시지 전엔 player 객체가 없어 주입한 명령이 버려진다.
  // 모르는 단어가 있는 줄 끝에서 MV 가 멈춰 유저를 기다리는 중. 유저가 MV 를 직접 이어 틀면 풀린다.
  const [waiting, setWaiting] = useState(false);

  const handleStateChange = useCallback((state: string) => {
    if (state === 'playing') setWaiting(false);
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
      if (Math.abs(ms - target) > 1500) {
        // 1초가 지나도 목표 근처가 아니면 seek 가 버려진 것이다. 그대로 두면 모든 시각을 무시해 줄 끝에서 멈추지 못한다.
        staleTicksRef.current += 1;
        if (staleTicksRef.current >= 10) {
          staleTicksRef.current = 0;
          playerRef.current?.seekTo(target / 1000);
        }
        return;
      }
      seekTargetMsRef.current = null;
    }
    const line = lines[pos];
    if (line.unseenCount > 0) {
      if (line.clipEndMs != null && ms >= line.clipEndMs) {
        followingRef.current = false;
        playerRef.current?.pause();
        setWaiting(true);
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
    setWaiting(false);
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
  const backdrop = useArtBackdrop(data?.song.artworkUrl);

  // 가사는 한 줄기로 늘어놓고 줄기 전체를 스프링으로 끌어 올려 지금 줄을 같은 자리에 앉힌다.
  const translateY = useSharedValue(0);
  // 지금 줄이 앉는 translateY. 끌기는 여기보다 위(안 온 줄)로는 고무줄처럼만 늘어난다.
  const restY = useSharedValue(0);
  const dragStartY = useSharedValue(0);
  const focusTop = useSharedValue(FOCUS_TOP);
  // 제스처 worklet 이 줄 자리로 앉히려면 JS 쪽 값을 UI 스레드에도 둬야 한다.
  const lineTops = useSharedValue<number[]>([]);
  const positionSV = useSharedValue(0);
  const viewIndex = useSharedValue(0);
  const dragStartIndex = useSharedValue(0);
  const tickIndex = useSharedValue(0);
  const lineTopsRef = useRef<number[]>([]);
  const focusTopRef = useRef(FOCUS_TOP);
  const placedRef = useRef(false);

  const settle = useCallback(() => {
    const pos = positionRef.current;
    const lines = studyLinesRef.current;
    const far = furthestRef.current != null && lines != null ? lastReachablePosition(lines, furthestRef.current) : null;
    const top = pos != null ? lineTopsRef.current[pos] : undefined;
    const farTop = far != null ? lineTopsRef.current[far] : undefined;
    if (pos == null || far == null || top == null || farTop == null) return;
    const target = focusTopRef.current - top;
    restY.value = focusTopRef.current - farTop;
    positionSV.value = far;
    viewIndex.value = pos;
    // 처음 앉을 땐 맨 위에서 굴러 내려오지 않게 제자리에 둔다.
    if (!placedRef.current) {
      placedRef.current = true;
      translateY.value = target;
      return;
    }
    translateY.value = withSpring(target, LINE_SPRING);
  }, [positionSV, restY, translateY, viewIndex]);

  // 단어를 풀고 돌아와 줄이 열리면 끌어 갈 수 있는 줄이 늘어난다.
  useEffect(() => {
    settle();
  }, [position, settle, studyLines]);

  // 번역이 열리면 그 줄 아래가 밀린다. 지금 줄 위쪽 높이가 바뀌면 다시 앉힌다.
  // 처음 뜰 땐 줄 수만큼 layout 이 몰려 와서, 줄마다 배열을 UI 스레드로 보내지 않고 한 프레임에 한 번만 보낸다.
  const layoutFrameRef = useRef<number | null>(null);
  const layoutNeedsSettleRef = useRef(false);
  const handleLineLayout = useCallback((linePosition: number, y: number) => {
    lineTopsRef.current[linePosition] = y;
    const lines = studyLinesRef.current;
    const far = furthestRef.current != null && lines != null ? lastReachablePosition(lines, furthestRef.current) : null;
    if (far != null && linePosition <= far) layoutNeedsSettleRef.current = true;
    if (layoutFrameRef.current != null) return;
    layoutFrameRef.current = requestAnimationFrame(() => {
      layoutFrameRef.current = null;
      lineTops.value = [...lineTopsRef.current];
      if (!layoutNeedsSettleRef.current) return;
      layoutNeedsSettleRef.current = false;
      settle();
    });
  }, [lineTops, settle]);
  useEffect(() => () => {
    if (layoutFrameRef.current != null) cancelAnimationFrame(layoutFrameRef.current);
  }, []);

  // 손으로 넘겨 앉힌 줄로 MV 와 단어 목록도 옮긴다. 열린 줄이면 MV 가 거기서부터 다시 흘러간다.
  const selectLine = useCallback((linePosition: number) => {
    const line = studyLinesRef.current?.[linePosition];
    if (line == null || linePosition === positionRef.current) return;
    positionRef.current = linePosition;
    setPosition(linePosition);
    setWaiting(false);
    playClip(line);
  }, [playClip]);

  const handleLyricsLayout = useCallback((event: LayoutChangeEvent) => {
    focusTopRef.current = Math.min(FOCUS_TOP, event.nativeEvent.layout.height * 0.3);
    focusTop.value = focusTopRef.current;
    settle();
  }, [focusTop, settle]);

  // 곡 상세 가사 다이얼처럼 줄 단위로 넘긴다. 손을 따라오다 놓으면 가까운 줄에 앉고, 관성으로 굴러가지 않는다.
  // 지나온 줄은 첫 줄까지 넘겨 볼 수 있고, 아직 안 온 줄 쪽으로는 고무줄처럼만 늘어났다 지금 줄로 돌아온다.
  const lyricsPan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onStart(() => {
      cancelAnimation(translateY);
      dragStartY.value = translateY.value;
      dragStartIndex.value = viewIndex.value;
      tickIndex.value = viewIndex.value;
    })
    .onUpdate(event => {
      const min = restY.value;
      const max = Math.max(min, focusTop.value);
      const raw = dragStartY.value + event.translationY;
      translateY.value = raw < min ? min - rubberBand(min - raw) : raw > max ? max + rubberBand(raw - max) : raw;
      const nearest = snapLineIndex(lineTops.value, translateY.value, focusTop.value, dragStartIndex.value, 0, positionSV.value);
      if (nearest !== tickIndex.value) {
        tickIndex.value = nearest;
        runOnJS(hapticLineTick)();
      }
    })
    .onEnd(event => {
      const target = snapLineIndex(
        lineTops.value,
        translateY.value,
        focusTop.value,
        dragStartIndex.value,
        event.velocityY,
        positionSV.value,
      );
      const top = lineTops.value[target];
      if (top == null) return;
      viewIndex.value = target;
      translateY.value = withSpring(focusTop.value - top, LINE_SPRING);
      if (target !== dragStartIndex.value) runOnJS(selectLine)(target);
    })
    .onFinalize((_, success) => {
      // onEnd 없이 취소되면 끌던 자리에 멈춰 있지 않게 보던 줄로 되돌린다.
      if (success) return;
      const top = lineTops.value[viewIndex.value];
      if (top != null) translateY.value = withSpring(focusTop.value - top, LINE_SPRING);
    }), [dragStartIndex, dragStartY, focusTop, lineTops, positionSV, restY, selectLine, tickIndex, translateY, viewIndex]);

  const columnStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const progress = useSharedValue(0);
  const total = studyLines?.length ?? 0;
  useEffect(() => {
    progress.value = withTiming(total > 0 ? openedCount / total : 0, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [openedCount, progress, total]);
  const progressStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  const countLabel = studyLines != null ? `${openedCount}/${studyLines.length}줄` : null;

  return (
    <View style={styles.screen}>
      <LinearGradient style={StyleSheet.absoluteFill} colors={FALLBACK_BACKDROP} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      {backdrop != null && (
        <Animated.View key={backdrop.join()} pointerEvents="none" entering={FadeIn.duration(600)} style={StyleSheet.absoluteFill}>
          <LinearGradient style={StyleSheet.absoluteFill} colors={backdrop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        </Animated.View>
      )}
      {/* 밝은 커버에서도 흰 글자가 읽히게 위아래만 어둡게 누른다. */}
      <LinearGradient
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        colors={['#00000073', '#00000014', '#00000014', '#0000008C']}
        locations={[0, 0.35, 0.6, 1]}
      />

      <View style={{ height: insets.top }} />
      {videoId != null ? (
        <View style={[styles.video, { height: Math.round(width * 9 / 16) }]}>
          {entryClip != null && <YouTubePlayer
            ref={playerRef}
            videoId={videoId}
            autoplay={entryClip.clipStartMs != null}
            startSeconds={(entryClip.clipStartMs ?? 0) / 1000}
            onStateChange={handleStateChange}
            onTimeChange={handleTimeChange}
          />}
          {/* iframe 이 띄우는 채널 아바타·제목 위에 뒤로 버튼이 묻히지 않게, YouTube 앱처럼 판 대신 영상 윗단만 누른다. */}
          <LinearGradient
            pointerEvents="none"
            style={styles.videoTopScrim}
            colors={['#000000A6', '#00000000']}
          />
          {waiting && !opened && (
            // 유저가 MV 를 눌러 이어 틀 수 있게 터치는 통과시킨다.
            <Animated.View
              pointerEvents="none"
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              style={styles.videoPaused}
            >
              {/* 멈춘 이유를 MV 자리에서 바로 말한다. 이유 없이 멈추면 고장이나 버퍼링으로 읽힌다. */}
              <Text style={styles.videoPausedTitle}>모르는 단어가 있어 멈췄어요</Text>
              <Text style={styles.videoPausedHint}>{`단어 ${current?.unseenCount ?? 0}개를 풀면 번역과 함께 다시 재생돼요`}</Text>
            </Animated.View>
          )}
          <BackButton onPress={goBack} style={styles.backOverlay} />
          {countLabel != null && <Text style={[styles.count, styles.countOverlay]}>{countLabel}</Text>}
        </View>
      ) : (
        <View style={styles.bareTop}>
          <BackButton onPress={goBack} />
          {countLabel != null && <Text style={styles.count}>{countLabel}</Text>}
        </View>
      )}
      {/* 제목·줄 수 줄을 따로 두면 가사 자리가 줄어서, 진행은 MV 아래 경계선 하나로만 보인다. */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      <GestureDetector gesture={lyricsPan}>
        <View style={styles.lyrics} onLayout={handleLyricsLayout}>
          <Animated.View style={[styles.lyricsColumn, columnStyle]}>
            {/* 들어올 때 이미 열린 줄 번역까지 한꺼번에 FadeIn 하면 랜딩이 버벅인다. 들어온 뒤 열리는 번역만 연출한다. */}
            {studyLines != null && <LayoutAnimationConfig skipEntering>
            {studyLines.map((line, linePosition) => (
              <StudyLyricLine
                key={line.line.index}
                line={line}
                linePosition={linePosition}
                scrollY={translateY}
                focusTop={focusTop}
                isFocused={linePosition === position}
                isWaiting={waiting && linePosition === position}
                isReached={furthest != null && linePosition <= furthest}
                onLineLayout={handleLineLayout}
              />
            ))}
            </LayoutAnimationConfig>}
          </Animated.View>
        </View>
      </GestureDetector>

      {current != null && current.words.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(160)}
          style={styles.words}
        >
          {/* 줄이 바뀌면 단어 묶음째 갈아 끼운다. 줄이 다 앉을 즈음 떠오르게 조금 늦춘다. */}
          <LineWordList key={current.line.index} words={current.words} />
        </Animated.View>
      )}

      {current != null && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {canReplay && (
            <Pressable
              onPress={replay}
              style={({ pressed }) => [styles.replay, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="이 줄 다시 듣기"
            >
              <MaterialIcons name="replay" size={24} color="#FFFFFF" />
            </Pressable>
          )}
          <CtaPulse style={styles.primary} active={waiting && !opened}>
            <Button
              size="lg"
              label={opened ? (isLast ? '곡으로 돌아가기' : '다음 줄') : `단어 ${current.unseenCount}개 풀기`}
              onPress={opened ? goNext : solveLine}
            />
          </CtaPulse>
        </View>
      )}
    </View>
  );
}

/** 앱바 대신 MV 위에 떠 있는 뒤로 버튼. MV 위에서는 원 배경 대신 윗단 scrim 이 대비를 맡는다. */
const BackButton = React.memo(function BackButton({ onPress, style }: { onPress: () => void; style?: object }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.back, style, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="뒤로"
    >
      <Feather name="chevron-left" size={22} color="#FFFFFF" />
    </Pressable>
  );
});

/** 버튼 둘레로 두 겹이 엇갈려 번진다. MV 가 멈춘 이유가 이 버튼이라는 걸 가리킨다. */
export const CtaPulse = React.memo(function CtaPulse({
  active,
  style,
  children,
}: {
  active: boolean;
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!active) {
      cancelAnimation(scale);
      scale.value = withTiming(1, { duration: 150 });
      return;
    }
    scale.value = withRepeat(withSequence(
      withTiming(CTA_PULSE_SCALE, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 380, easing: Easing.inOut(Easing.quad) }),
      withTiming(1, { duration: RIPPLE_MS - 600 }),
    ), -1);
  }, [active, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={style}>
      {active && (
        <>
          <RippleRing delay={0} />
          <RippleRing delay={RIPPLE_MS / 2} />
        </>
      )}
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </View>
  );
});

const RippleRing = React.memo(function RippleRing({ delay }: { delay: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withRepeat(withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.quad) }), -1));
    return () => cancelAnimation(progress);
  }, [delay, progress]);
  const style = useAnimatedStyle(() => {
    const spread = progress.value * RIPPLE_SPREAD;
    return { top: -spread, bottom: -spread, left: -spread, right: -spread, opacity: 0.45 * (1 - progress.value) };
  });
  return <Animated.View pointerEvents="none" style={[styles.ripple, style]} />;
});

interface StudyLyricLineProps {
  line: StudyLine;
  linePosition: number;
  scrollY: SharedValue<number>;
  focusTop: SharedValue<number>;
  isFocused: boolean;
  isWaiting: boolean;
  isReached: boolean;
  onLineLayout: (linePosition: number, y: number) => void;
}

/** 지나온 열린 줄엔 번역이 남는다. 아직 안 온 줄은 가사만 보여 번역을 미리 흘리지 않는다. */
const StudyLyricLine = React.memo(function StudyLyricLine({
  line,
  linePosition,
  scrollY,
  focusTop,
  isFocused,
  isWaiting,
  isReached,
  onLineLayout,
}: StudyLyricLineProps) {
  const top = useSharedValue(0);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    top.value = event.nativeEvent.layout.y;
    onLineLayout(linePosition, event.nativeEvent.layout.y);
  }, [linePosition, onLineLayout, top]);
  // 지금 줄 번호가 아니라 화면 위치로 흐림을 정해, 지나온 줄로 끌어 올리면 그 줄이 또렷해진다.
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(top.value + scrollY.value - focusTop.value) / LINE_PITCH;
    return {
      opacity: interpolate(distance, DISTANCE_STEPS, DISTANCE_OPACITY, Extrapolation.CLAMP),
      transform: [{ scale: interpolate(distance, [0, 1], [1, 0.94], Extrapolation.CLAMP) }],
    };
  });
  const opened = line.unseenCount === 0;
  const translation = line.line.koreanLyrics;
  // 잠긴 칸을 본 줄이 열릴 때만 푸는 연출을 준다. 처음부터 열린 줄은 조용히 번역만 뜬다.
  const shownLockedRef = useRef(false);
  if (isFocused && !opened && translation != null) shownLockedRef.current = true;

  return (
    <Animated.View onLayout={handleLayout} style={[styles.lyricLine, animatedStyle]}>
      <Text style={styles.lyricText}>{line.line.originalText}</Text>
      {isReached && opened && translation != null && shownLockedRef.current && (
        <UnlockedTranslation translation={translation} />
      )}
      {isReached && opened && translation != null && !shownLockedRef.current && (
        <Animated.Text entering={FadeIn.duration(REVEAL_MOTION_MS)} style={styles.lyricTranslation}>
          {translation}
        </Animated.Text>
      )}
      {isFocused && !opened && translation != null && (
        // 비어 있는 막대는 로딩처럼 보여서, 잠긴 칸은 자물쇠와 점선 테두리로 그린다.
        <Animated.View entering={FadeIn.duration(REVEAL_MOTION_MS).delay(120)}>
          <LockedTranslation waiting={isWaiting} />
        </Animated.View>
      )}
    </Animated.View>
  );
});

/** MV 가 이 줄에서 멈춰 있는 동안엔 칸이 숨 쉬듯 밝아졌다 흐려진다. */
const LockedTranslation = React.memo(function LockedTranslation({ waiting }: { waiting: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!waiting) {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, waiting]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.65 + 0.35 * pulse.value,
    borderColor: `rgba(255, 255, 255, ${0.25 + 0.4 * pulse.value})`,
  }));
  return (
    <Animated.View style={[styles.translationLocked, animatedStyle]}>
      <Ionicons name="lock-closed" size={13} color="#FFFFFFB3" />
      <Text style={styles.translationLockedLabel}>모르는 단어를 풀면 번역이 열려요</Text>
    </Animated.View>
  );
});

/**
 * 잠긴 칸이 번역으로 바뀐다. 자물쇠가 열리며 톡, 칸이 녹고 어절이 차례로 차오르며 틱틱틱, 다 차면 성공 진동으로 맺는다.
 * 번역 자리를 처음부터 잡아 두고 그 위에 잠긴 칸을 겹쳐서 칸이 사라질 때 아래 줄이 덜컥이지 않는다.
 */
const UnlockedTranslation = React.memo(function UnlockedTranslation({ translation }: { translation: string }) {
  const words = useMemo(() => translation.split(/\s+/).filter(Boolean), [translation]);
  const stagger = words.length > 1 ? Math.min(UNLOCK_WORD_STAGGER_MS, UNLOCK_WORDS_MAX_MS / (words.length - 1)) : 0;
  const popAt = UNLOCK_START_MS + UNLOCK_POP_MS;
  const fillAt = popAt + UNLOCK_FILL_MS;
  const [unlocked, setUnlocked] = useState(false);
  const lockScale = useSharedValue(1);
  const lockOpacity = useSharedValue(1);

  useEffect(() => {
    lockScale.value = withDelay(popAt, withSequence(
      withTiming(1.25, { duration: 110, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 9, stiffness: 260 }),
    ));
    lockOpacity.value = withDelay(popAt + 120, withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) }));
    const timers = [
      setTimeout(() => {
        setUnlocked(true);
        hapticUnlock();
      }, popAt),
      ...words.map((_, index) => setTimeout(
        index === words.length - 1 ? hapticTranslationOpened : hapticTranslationWord,
        fillAt + index * stagger,
      )),
    ];
    return () => timers.forEach(clearTimeout);
    // 열리는 순간 한 번만 푼다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lockStyle = useAnimatedStyle(() => ({ opacity: lockOpacity.value }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: lockScale.value }] }));

  return (
    <View>
      <View style={styles.translationWords}>
        {words.map((word, index) => (
          <TranslationWord key={index} word={word} delay={fillAt + index * stagger} />
        ))}
      </View>
      <Animated.View pointerEvents="none" style={[styles.translationLocked, styles.translationLockedOverlay, lockStyle]}>
        <Animated.View style={iconStyle}>
          <Ionicons name={unlocked ? 'lock-open' : 'lock-closed'} size={13} color={unlocked ? '#FFFFFF' : '#FFFFFFB3'} />
        </Animated.View>
        <Text style={styles.translationLockedLabel}>모르는 단어를 풀면 번역이 열려요</Text>
      </Animated.View>
    </View>
  );
});

const TranslationWord = React.memo(function TranslationWord({ word, delay }: { word: string; delay: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 6 }],
  }));
  return <Animated.Text style={[styles.lyricTranslation, styles.translationWord, style]}>{word}</Animated.Text>;
});

/** 단어가 많아 칸을 넘치면 아직 안 본 첫 단어가 칸 맨 위에 오게 내린다. 아는 단어부터 읽고 내려가지 않게. */
export const LineWordList = React.memo(function LineWordList({ words }: { words: readonly WordInSongItemDto[] }) {
  const scrollRef = useRef<ScrollView>(null);
  const rowTopsRef = useRef<number[]>([]);
  const firstUnseen = words.findIndex(word => !isWordSeen(word));

  const scrollToFirstUnseen = useCallback((animated: boolean) => {
    const top = firstUnseen >= 0 ? rowTopsRef.current[firstUnseen] : undefined;
    if (top != null) scrollRef.current?.scrollTo({ y: top, animated });
  }, [firstUnseen]);

  // 단어를 풀고 돌아오면 첫 안 본 단어가 바뀐다.
  useEffect(() => {
    scrollToFirstUnseen(true);
  }, [scrollToFirstUnseen]);

  const handleRowLayout = useCallback((index: number, y: number) => {
    rowTopsRef.current[index] = y;
    if (index === firstUnseen) scrollToFirstUnseen(false);
  }, [firstUnseen, scrollToFirstUnseen]);

  return (
    <ScrollView ref={scrollRef} style={styles.wordsScroll}>
      <Animated.View entering={FadeIn.duration(260).delay(120)}>
        {/* 묶음째 떠오르니 행마다 뜻을 또 페이드하지 않는다. 풀고 돌아와 새로 본 단어만 뜻이 떠오른다. */}
        <LayoutAnimationConfig skipEntering>
          {words.map((word, index) => (
            <LineWordRow key={word.japanese} word={word} index={index} onRowLayout={handleRowLayout} />
          ))}
        </LayoutAnimationConfig>
      </Animated.View>
    </ScrollView>
  );
});

/** 누를 수 있는 칩처럼 보이지 않게 테두리 없는 행으로 둔다. 안 본 단어는 뜻 자리에 자물쇠만 둔다. */
interface LineWordRowProps {
  word: WordInSongItemDto;
  index: number;
  onRowLayout: (index: number, y: number) => void;
}

const LineWordRow = React.memo(function LineWordRow({ word, index, onRowLayout }: LineWordRowProps) {
  const seen = isWordSeen(word);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => onRowLayout(index, event.nativeEvent.layout.y),
    [index, onRowLayout],
  );
  const readingDisplay = useSettingsStore(s => s.readingDisplay);
  const reading = word.reading != null ? convertReading(word.reading, readingDisplay) : null;
  return (
    <View style={styles.wordRow} onLayout={handleLayout}>
      <Ionicons
        name={seen ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={seen ? Colors.primary : '#FFFFFF59'}
      />
      <Text style={[styles.wordText, !seen && styles.wordTextUnseen]} numberOfLines={1}>
        {word.surface}
        {reading != null && reading !== word.surface && (
          <Text style={styles.wordReading}>{`  ${reading}`}</Text>
        )}
      </Text>
      {seen ? (
        <Animated.Text entering={FadeIn.duration(REVEAL_MOTION_MS)} style={styles.wordMeaning} numberOfLines={1}>
          {word.koreanText ?? ''}
        </Animated.Text>
      ) : (
        <Ionicons name="lock-closed" size={13} color="#FFFFFF59" style={styles.wordMeaningLocked} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: FALLBACK_BACKDROP[1],
  },
  video: {
    backgroundColor: '#000000',
  },
  bareTop: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000059',
  },
  videoPaused: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 24,
    backgroundColor: '#000000A6',
  },
  videoPausedTitle: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  videoPausedHint: {
    ...Typography.bodyMedium,
    color: '#FFFFFFB3',
    fontSize: 13,
    textAlign: 'center',
  },
  videoTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  backOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.7,
  },
  count: {
    ...Typography.bodySemiBold,
    color: '#FFFFFFCC',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    overflow: 'hidden',
    backgroundColor: '#00000059',
  },
  countOverlay: {
    position: 'absolute',
    top: 16,
    right: 12,
    backgroundColor: 'transparent',
  },
  progressTrack: {
    height: 2,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF1F',
  },
  progressFill: {
    flex: 1,
    backgroundColor: '#FFFFFFCC',
    transformOrigin: 'left',
  },
  lyrics: {
    flex: 1,
    overflow: 'hidden',
  },
  lyricsColumn: {
    paddingHorizontal: 24,
  },
  lyricLine: {
    paddingVertical: 12,
    transformOrigin: 'left center',
  },
  lyricText: {
    ...Typography.headingBold,
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 34,
  },
  lyricTranslation: {
    ...Typography.bodyMedium,
    color: '#FFFFFFB3',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 6,
  },
  translationLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#FFFFFF40',
  },
  translationLockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    marginTop: 0,
  },
  translationWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 4,
    marginTop: 6,
  },
  translationWord: {
    marginTop: 0,
  },
  translationLockedLabel: {
    ...Typography.bodyMedium,
    color: '#FFFFFF80',
    fontSize: 13,
  },
  words: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#0000002E',
  },
  wordsScroll: {
    flexGrow: 0,
    maxHeight: WORDS_MAX_HEIGHT,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  wordText: {
    ...Typography.bodySemiBold,
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  wordTextUnseen: {
    color: '#FFFFFFA6',
  },
  wordReading: {
    ...Typography.body,
    color: '#FFFFFF73',
    fontSize: 12,
  },
  wordMeaning: {
    ...Typography.body,
    flex: 1,
    textAlign: 'right',
    color: '#FFFFFFBF',
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
    paddingTop: 14,
  },
  replay: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF24',
  },
  primary: {
    flex: 1,
  },
  // 테두리만 두면 어두운 배경에서 잘 안 보여 면으로 번진다.
  ripple: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: Colors.primary,
  },
});

function rubberBand(distance: number): number {
  'worklet';
  return RUBBER_LIMIT * (1 - 1 / (distance / RUBBER_LIMIT * 0.55 + 1));
}
