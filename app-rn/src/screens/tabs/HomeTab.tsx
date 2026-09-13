import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  HomeExpandedHeader,
  HOME_HEADER_CONTENT_HEIGHT,
  StackReviewOverlay,
  STACK_REVIEW_CHROME_HEIGHT,
  StudyStack,
  useStudyStack,
} from '../../components/studyStack';
import { useHomeChromeStore } from '../../stores/homeChromeStore';
import { RootStackParamList, TabParamList } from '../../navigation/AppNavigator';
import { immerseProgress, shouldStartImmersePan } from './homeImmerseGesture';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** 손을 뗀 뒤 남은 구간을 마저 접거나 되돌리는 시간. */
const IMMERSE_SETTLE_MS = 320;
const IMMERSE_REVERT_MS = 220;

export default function HomeTab() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const stack = useStudyStack({ mode: 'home' });
  const { deckStripItems, isComplete, reload, selectSource, session, status, streak } = stack;
  const visibleSongId = stack.visibleSource?.songId ?? null;
  const selectedSongId = stack.selectedSource?.songId ?? null;

  const immersed = useHomeChromeStore(s => s.isDark);
  const setDark = useHomeChromeStore(s => s.setDark);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const immersedRef = useRef(immersed);
  immersedRef.current = immersed;
  const immerse = useSharedValue(immersed ? 1 : 0);

  // 이미 홈탭에 있는 상태에서 홈탭을 다시 누르면 몰입 모드를 풀고 스택을 새로고침한다.
  useEffect(() => navigation.addListener('tabPress', () => {
    if (!focusedRef.current) return;
    immerse.value = 0;
    setDark(false);
    reload();
  }), [immerse, navigation, reload, setDark]);

  // 몰입 규칙:
  //  ① 몰입 밖에서는 카드를 못 만진다 — 탭이든 드래그든 몰입 진입이다 (WordLayer 잠금 오버레이).
  //  ② 세로 드래그가 몰입 값을 끈다 — 몰입 중엔 아래로, 아니면 위로. 카드 앞뒤면은 무관하다.
  //  ③ 놓으면 가까운 쪽(0.5 기준)으로 붙는다.
  // immerse 는 헤더 transform 뿐 아니라 카드 안쪽 여백(레이아웃 값)까지 끌기 때문에
  // RN Animated 네이티브 드라이버로는 못 돌린다 — Reanimated shared value 로 두 층이 같은 값을
  // UI 스레드에서 읽는다. setDark 가 일으키는 JS 리렌더가 애니메이션 프레임을 못 뺏는다.
  const setImmersed = useCallback((next: boolean) => {
    setDark(next);
    immerse.value = withTiming(next ? 1 : 0, {
      duration: next ? IMMERSE_SETTLE_MS : IMMERSE_REVERT_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [immerse, setDark]);

  const enterImmerse = useCallback(() => setImmersed(true), [setImmersed]);

  const immersePan = useMemo(
    () => PanResponder.create({
      // capture 단계에서 잡아야 카드 안쪽 ScrollView/Pressable 보다 먼저 온다.
      // 몰입 중 뒷면 rating 스와이프(위)와는 방향이 반대라 겹치지 않는다.
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        shouldStartImmersePan(immersedRef.current, gesture),
      onPanResponderMove: (_, gesture) => {
        immerse.value = immerseProgress(immersedRef.current, gesture.dy);
      },
      onPanResponderRelease: (_, gesture) =>
        setImmersed(immerseProgress(immersedRef.current, gesture.dy) >= 0.5),
      onPanResponderTerminate: () => setImmersed(immersedRef.current),
    }),
    [immerse, setImmersed],
  );

  const goSearch = useCallback(() => navigation.navigate('Search'), [navigation]);

  const openSource = useCallback(() => {
    if (visibleSongId == null) return;
    navigation.navigate('SongDetail', { songId: visibleSongId, origin: 'Home' });
  }, [navigation, visibleSongId]);

  const openExampleSource = useCallback((songId: number) => {
    navigation.navigate('SongDetail', { songId, origin: 'Home' });
  }, [navigation]);

  // 세션 시작 시점에 due 가 없었는데 도중에 새로 due 된 카드를 리뷰하면 queueTotal 이 0으로 남는다.
  const counterTotal = session.queueTotal > 0 ? session.queueTotal : session.reviewedCount;
  const counterPosition = session.queueTotal > 0 ? session.position : session.reviewedCount;

  // 카드 안쪽 내용은 헤더가 올라가는 만큼 같이 따라 올라간다 — 헤더는 자기 높이 전체를,
  // 카드는 두 크롬의 차이만큼만 움직여서 시차가 생긴다.
  const expandedInset = insets.top + HOME_HEADER_CONTENT_HEIGHT;
  const immersedInset = insets.top + STACK_REVIEW_CHROME_HEIGHT;
  const contentInsetTop = useDerivedValue(
    () => interpolate(immerse.value, [0, 1], [expandedInset, immersedInset], Extrapolation.CLAMP),
    [immerse, expandedInset, immersedInset],
  );

  // 진행 바·카운터는 헤더 아래에서 같이 딸려 올라오며 드러난다. 헤더가 다 걷힌 뒤
  // 뒤늦게 켜지면 튀어 보인다.
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(immerse.value, [0.2, 0.8], [0, 1], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(immerse.value, [0.2, 1], [12, 0], Extrapolation.CLAMP),
    }],
  }), [immerse]);

  const showProgress = status === 'ready' && !isComplete;
  const overlay = useMemo(() => (
    <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents="box-none">
      <StackReviewOverlay
        position={counterPosition}
        queueTotal={counterTotal}
        queueProgress={session.queueProgress}
        showProgress={showProgress}
      />
    </Animated.View>
  ), [overlayStyle, counterPosition, counterTotal, session.queueProgress, showProgress]);

  return (
    <View style={styles.screen}>
      <View style={styles.stackWrap} {...immersePan.panHandlers}>
        <StudyStack
          stack={stack}
          onOpenSource={openSource}
          onOpenExampleSource={openExampleSource}
          onSearch={goSearch}
          overlay={overlay}
          contentInsetTop={contentInsetTop}
          requireImmersedInteraction={!immersed}
          onRequestImmerse={enterImmerse}
        />
      </View>
      <HomeExpandedHeader
        streak={streak}
        deckStripItems={deckStripItems}
        selectedSongId={selectedSongId}
        onSelectDeckStripItem={selectSource}
        onSearch={goSearch}
        immerse={immerse}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#14181C',
  },
  stackWrap: {
    flex: 1,
  },
});
