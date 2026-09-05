import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, View } from 'react-native';
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
  StudySource,
  StudyStack,
  useStudyStack,
} from '../../components/studyStack';
import { useHomeChromeStore } from '../../stores/homeChromeStore';
import { RootStackParamList, TabParamList } from '../../navigation/AppNavigator';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** 헤더가 완전히 접히는 드래그 거리. 손가락이 이 구간을 그대로 끌고 간다. */
const IMMERSE_DISTANCE = 120;
/** 놓았을 때 접힘으로 확정되는 지점. */
const IMMERSE_COMMIT_DISTANCE = -56;
/** 몰입 상태에서 놓았을 때 펼침으로 확정되는 지점. */
const IMMERSE_EXIT_COMMIT_DISTANCE = 56;
/** 손을 뗀 뒤 남은 구간을 마저 접거나 되돌리는 시간. */
const IMMERSE_SETTLE_MS = 320;
const IMMERSE_REVERT_MS = 220;

export default function HomeTab() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const stack = useStudyStack({ mode: 'home' });
  const { isComplete, revealed, reload, session, status, streak, weekDots } = stack;
  const visibleSongId = stack.visibleSource?.songId ?? null;

  const immersed = useHomeChromeStore(s => s.isDark);
  const setDark = useHomeChromeStore(s => s.setDark);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const immersedRef = useRef(immersed);
  immersedRef.current = immersed;
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const immerse = useRef(new Animated.Value(immersed ? 1 : 0)).current;

  // 이미 홈탭에 있는 상태에서 홈탭을 다시 누르면 몰입 모드를 풀고 스택을 새로고침한다.
  useEffect(() => navigation.addListener('tabPress', () => {
    if (!focusedRef.current) return;
    immerse.setValue(0);
    setDark(false);
    reload();
  }), [immerse, navigation, reload, setDark]);

  // immerse 는 헤더 transform 뿐 아니라 카드 안쪽 여백(레이아웃 값)까지 끌기 때문에
  // 네이티브 드라이버를 쓸 수 없다 — 두 층이 같은 값을 봐야 어긋나지 않는다.
  const settle = useCallback((toValue: 0 | 1) => {
    Animated.timing(immerse, {
      toValue,
      duration: toValue === 1 ? IMMERSE_SETTLE_MS : IMMERSE_REVERT_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [immerse]);

  const enterImmerse = useCallback(() => {
    if (immersedRef.current) return;
    setDark(true);
    settle(1);
  }, [setDark, settle]);

  const exitImmerse = useCallback(() => {
    if (!immersedRef.current) return;
    setDark(false);
    settle(0);
  }, [setDark, settle]);

  const immersePan = useMemo(
    () => PanResponder.create({
      // 카드가 앞면일 때만 세로 드래그를 가로챈다 — 뒷면 rating 스와이프와는 상태로 배타적이다.
      onMoveShouldSetPanResponder: (_, gesture) =>
        !immersedRef.current && !revealedRef.current && gesture.dy < -8,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy >= 0) return;
        immerse.setValue(Math.min(1, -gesture.dy / IMMERSE_DISTANCE));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < IMMERSE_COMMIT_DISTANCE) {
          enterImmerse();
          return;
        }
        settle(0);
      },
      onPanResponderTerminate: () => {
        if (immersedRef.current) return;
        settle(0);
      },
    }),
    [enterImmerse, immerse, settle],
  );

  const chromeImmersePan = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        const isVertical = Math.abs(gesture.dy) > Math.abs(gesture.dx);
        return isVertical && (
          (immersedRef.current && gesture.dy > 8)
          || (!immersedRef.current && gesture.dy < -8)
        );
      },
      onPanResponderMove: (_, gesture) => {
        if (immersedRef.current) {
          if (gesture.dy <= 0) return;
          immerse.setValue(Math.max(0, 1 - gesture.dy / IMMERSE_DISTANCE));
          return;
        }
        if (gesture.dy >= 0) return;
        immerse.setValue(Math.min(1, -gesture.dy / IMMERSE_DISTANCE));
      },
      onPanResponderRelease: (_, gesture) => {
        if (immersedRef.current) {
          if (gesture.dy > IMMERSE_EXIT_COMMIT_DISTANCE) {
            exitImmerse();
            return;
          }
          settle(1);
          return;
        }
        if (gesture.dy < IMMERSE_COMMIT_DISTANCE) {
          enterImmerse();
          return;
        }
        settle(0);
      },
      onPanResponderTerminate: () => {
        if (immersedRef.current) {
          settle(1);
          return;
        }
        settle(0);
      },
    }),
    [enterImmerse, exitImmerse, immerse, settle],
  );

  const goSearch = useCallback(() => navigation.navigate('Search'), [navigation]);

  const openSource = useCallback(() => {
    if (visibleSongId == null) return;
    navigation.navigate('SongDetail', { songId: visibleSongId, origin: 'Home' });
  }, [navigation, visibleSongId]);

  const openRecommended = useCallback((recommended: StudySource) => {
    if (recommended.songId == null) return;
    navigation.navigate('SongDetail', { songId: recommended.songId, origin: 'Home' });
  }, [navigation]);

  const openExampleSource = useCallback((songId: number) => {
    navigation.navigate('SongDetail', { songId, origin: 'Home' });
  }, [navigation]);

  // 세션 시작 시점에 due 가 없었는데 도중에 새로 due 된 카드를 리뷰하면 queueTotal 이 0으로 남는다.
  const counterTotal = session.queueTotal > 0 ? session.queueTotal : session.reviewedCount;
  const counterPosition = session.queueTotal > 0 ? session.position : session.reviewedCount;

  // 카드 안쪽 내용은 헤더가 올라가는 만큼 같이 따라 올라간다 — 헤더는 자기 높이 전체를,
  // 카드는 두 크롬의 차이만큼만 움직여서 시차가 생긴다.
  const contentInsetTop = useMemo(
    () => immerse.interpolate({
      inputRange: [0, 1],
      outputRange: [
        insets.top + HOME_HEADER_CONTENT_HEIGHT,
        insets.top + STACK_REVIEW_CHROME_HEIGHT,
      ],
      extrapolate: 'clamp',
    }),
    [immerse, insets.top],
  );

  // 진행 바·카운터는 헤더 아래에서 같이 딸려 올라오며 드러난다. 헤더가 다 걷힌 뒤
  // 뒤늦게 켜지면 튀어 보인다.
  const overlayStyle = useMemo(
    () => ({
      opacity: immerse.interpolate({
        inputRange: [0.2, 0.8],
        outputRange: [0, 1],
        extrapolate: 'clamp' as const,
      }),
      transform: [{
        translateY: immerse.interpolate({
          inputRange: [0.2, 1],
          outputRange: [12, 0],
          extrapolate: 'clamp' as const,
        }),
      }],
    }),
    [immerse],
  );

  const overlay = (
    <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]} pointerEvents="box-none">
      <StackReviewOverlay
        position={counterPosition}
        queueTotal={counterTotal}
        queueProgress={session.queueProgress}
        showProgress={status === 'ready' && !isComplete}
      />
    </Animated.View>
  );

  const chromeGestureStyle = useMemo(
    () => ({
      height: insets.top + (immersed ? STACK_REVIEW_CHROME_HEIGHT : HOME_HEADER_CONTENT_HEIGHT),
    }),
    [immersed, insets.top],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.stackWrap} {...immersePan.panHandlers}>
        <StudyStack
          stack={stack}
          onOpenSource={openSource}
          onOpenExampleSource={openExampleSource}
          onSearch={goSearch}
          onSelectRecommended={openRecommended}
          overlay={overlay}
          contentInsetTop={contentInsetTop}
          requireImmersedInteraction={!immersed}
          onRequestImmerse={enterImmerse}
        />
      </View>
      <View
        style={[styles.chromeGestureArea, chromeGestureStyle]}
        {...chromeImmersePan.panHandlers}
      />
      <HomeExpandedHeader streak={streak} weekDots={weekDots} immerse={immerse} />
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
  chromeGestureArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
