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
  const { isComplete, reload, session, status, streak, weekDots } = stack;
  const visibleSongId = stack.visibleSource?.songId ?? null;

  const immersed = useHomeChromeStore(s => s.isDark);
  const setDark = useHomeChromeStore(s => s.setDark);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const immersedRef = useRef(immersed);
  immersedRef.current = immersed;
  const immerse = useRef(new Animated.Value(immersed ? 1 : 0)).current;

  // 이미 홈탭에 있는 상태에서 홈탭을 다시 누르면 몰입 모드를 풀고 스택을 새로고침한다.
  useEffect(() => navigation.addListener('tabPress', () => {
    if (!focusedRef.current) return;
    immerse.setValue(0);
    setDark(false);
    reload();
  }), [immerse, navigation, reload, setDark]);

  // 몰입 규칙:
  //  ① 몰입 밖에서는 카드를 못 만진다 — 탭이든 드래그든 몰입 진입이다 (WordLayer 잠금 오버레이).
  //  ② 세로 드래그가 몰입 값을 끈다 — 몰입 중엔 아래로, 아니면 위로. 카드 앞뒤면은 무관하다.
  //  ③ 놓으면 가까운 쪽(0.5 기준)으로 붙는다.
  // immerse 는 헤더 transform 뿐 아니라 카드 안쪽 여백(레이아웃 값)까지 끌기 때문에
  // 네이티브 드라이버를 쓸 수 없다 — 두 층이 같은 값을 봐야 어긋나지 않는다.
  const setImmersed = useCallback((next: boolean) => {
    setDark(next);
    Animated.timing(immerse, {
      toValue: next ? 1 : 0,
      duration: next ? IMMERSE_SETTLE_MS : IMMERSE_REVERT_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [immerse, setDark]);

  const enterImmerse = useCallback(() => setImmersed(true), [setImmersed]);

  const immersePan = useMemo(
    () => PanResponder.create({
      // capture 단계에서 잡아야 카드 안쪽 ScrollView/Pressable 보다 먼저 온다.
      // 몰입 중 뒷면 rating 스와이프(위)와는 방향이 반대라 겹치지 않는다.
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        shouldStartImmersePan(immersedRef.current, gesture),
      onPanResponderMove: (_, gesture) =>
        immerse.setValue(immerseProgress(immersedRef.current, gesture.dy)),
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
});
