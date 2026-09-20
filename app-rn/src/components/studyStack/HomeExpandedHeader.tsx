import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStreakStore } from '../../stores/streakStore';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { DeckStrip, DECK_STRIP_HEIGHT } from './DeckStrip';
import { StreakNudge } from './StreakNudge';
import { StudySource } from './types';

const APP_BAR_HEIGHT = 52;
/** 말풍선 꼬리 끝이 칩 아래 4px 에 오도록 앱바 바닥에서 끌어올리는 값. */
const NUDGE_OVERLAP = 12;

/** 곡 진입 복습과 다르게 홈 최초 진입은 덱 스트립까지 펼친다. */
export const HOME_HEADER_CONTENT_HEIGHT = APP_BAR_HEIGHT + DECK_STRIP_HEIGHT;

export interface HomeExpandedHeaderProps {
  /** 덱 스트립에 그릴 목록 — 곡 덱이 있으면 due 많은 순 덱, 없으면 추천곡. */
  deckStripItems: StudySource[];
  /** 덱 스트립에서 현재 강조돼야 할 곡. */
  selectedSongId: number | null;
  onSelectDeckStripItem: (source: StudySource) => void;
  onSearch: () => void;
  /** 0 = 펼침(H5), 1 = 몰입(H1). UI 스레드에서 굴러가는 값. */
  immerse: SharedValue<number>;
}

/**
 * H5 헤더 — 상태바 여백 + 워드마크·연속 학습 칩 앱바 + 덱 스트립. 위쪽 블록부터 먼저 빠진다.
 * 칩 숫자와 '오늘 아직' 말풍선은 streakStore 에서 읽는다 — 첫 rating 뒤 헤더가 다시
 * 펼쳐질 때 말풍선은 없고 숫자만 +1 돼 있다.
 */
export const HomeExpandedHeader = React.memo(function HomeExpandedHeader({
  deckStripItems,
  selectedSongId,
  onSelectDeckStripItem,
  onSearch,
  immerse,
}: HomeExpandedHeaderProps) {
  const insets = useSafeAreaInsets();
  const height = insets.top + HOME_HEADER_CONTENT_HEIGHT;
  const streak = useStreakStore(s => s.currentStreak);
  const showNudge = useStreakStore(s => s.loaded && !s.studiedToday);

  const shell = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(immerse.value, [0, 1], [0, -height]),
    }],
  }), [immerse, height]);
  const appBar = useAnimatedStyle(() => ({
    opacity: interpolate(immerse.value, [0, 0.55], [1, 0], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(immerse.value, [0, 0.6], [0, -18], Extrapolation.CLAMP),
    }],
  }), [immerse]);
  const deckStripAnim = useAnimatedStyle(() => ({
    opacity: interpolate(immerse.value, [0.15, 0.85], [1, 0], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(immerse.value, [0, 0.85], [0, -10], Extrapolation.CLAMP),
    }],
  }), [immerse]);

  return (
    <Animated.View style={[styles.shell, { height }, shell]} pointerEvents="box-none">
      <View style={{ height: insets.top }} pointerEvents="none" />
      <Animated.View style={[styles.appBar, appBar]} pointerEvents="none">
        <Text style={styles.wordmark}>Kotonoha</Text>
        <View style={styles.streak}>
          <Ionicons name="flame" size={20} color={Colors.streakFlame} />
          <View style={styles.streakLabel}>
            <Text style={styles.streakNum}>{streak}일</Text>
            <Text style={styles.streakWord}>연속</Text>
          </View>
        </View>
      </Animated.View>
      <Animated.View style={[styles.deckStripWrap, deckStripAnim]} pointerEvents="box-none">
        <DeckStrip
          items={deckStripItems}
          selectedSongId={selectedSongId}
          onSelect={onSelectDeckStripItem}
          onSearch={onSearch}
        />
      </Animated.View>
      {showNudge && (
        <Animated.View
          style={[styles.nudge, { top: insets.top + APP_BAR_HEIGHT - NUDGE_OVERLAP }, appBar]}
          pointerEvents="none"
        >
          <StreakNudge />
        </Animated.View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
  },
  appBar: {
    height: APP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  wordmark: {
    ...Typography.headingBold,
    fontSize: 21,
    letterSpacing: 0.2,
    color: Colors.textPrimary,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  streakLabel: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  streakNum: {
    ...Typography.bodyBold,
    fontSize: 14,
    letterSpacing: -0.2,
    color: Colors.textPrimary,
  },
  streakWord: {
    ...Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  deckStripWrap: {
    height: DECK_STRIP_HEIGHT,
  },
  // 덱 스트립 위에 떠 있다 — 스트립 자리를 차지하지 않는다.
  nudge: {
    position: 'absolute',
    right: 20,
  },
});
