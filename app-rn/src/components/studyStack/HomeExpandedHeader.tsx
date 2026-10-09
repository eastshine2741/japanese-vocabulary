import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeChipPalette } from '../streak/palette';
import { streakModeFromWeek } from '../streak/streakCalendar';
import { useStreakStore } from '../../stores/streakStore';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { DeckStrip, DECK_STRIP_HEIGHT } from './DeckStrip';
import { StreakNudge } from './StreakNudge';
import { StudySource } from './types';

const APP_BAR_HEIGHT = 62;
/** 말풍선 꼬리 끝이 칩 아래 4px 에 오도록 앱바 바닥에서 끌어올리는 값. */
const NUDGE_OVERLAP = 14;

/** 곡 진입 복습과 다르게 홈 최초 진입은 덱 스트립까지 펼친다. */
export const HOME_HEADER_CONTENT_HEIGHT = APP_BAR_HEIGHT + DECK_STRIP_HEIGHT;

export interface HomeExpandedHeaderProps {
  /** 덱 스트립에 그릴 목록 — 곡 덱이 있으면 due 많은 순 덱, 없으면 최근 연 곡(없으면 추천곡). */
  deckStripItems: StudySource[];
  /** 덱 스트립에서 현재 강조돼야 할 곡. */
  selectedSongId: number | null;
  onSelectDeckStripItem: (source: StudySource) => void;
  onSearch: () => void;
  /** 연속 학습 칩을 눌렀을 때 — 프로필 탭으로 보낸다. */
  onPressStreak: () => void;
  /** 오늘 아직 남은 due 장수. 0이면 숫자 블록 대신 워드마크를 띄운다. */
  dueRemaining: number;
  /** '오늘 복습할 단어가 N개' 블록을 눌렀을 때 — 오늘의 복습 스케줄로 보낸다. */
  onPressSchedule: () => void;
  /** 0 = 펼침(H5), 1 = 몰입(H1). UI 스레드에서 굴러가는 값. */
  immerse: SharedValue<number>;
}

/**
 * H5 헤더 — 상태바 여백 + 워드마크·연속 학습 칩 앱바 + 덱 스트립. 위쪽 블록부터 먼저 빠진다.
 * 칩 숫자와 '오늘 아직' 말풍선은 streakStore 에서 읽는다.
 */
export const HomeExpandedHeader = React.memo(function HomeExpandedHeader({
  deckStripItems,
  selectedSongId,
  onSelectDeckStripItem,
  onSearch,
  onPressStreak,
  dueRemaining,
  onPressSchedule,
  immerse,
}: HomeExpandedHeaderProps) {
  const insets = useSafeAreaInsets();
  const height = insets.top + HOME_HEADER_CONTENT_HEIGHT;
  const streak = useStreakStore(s => s.currentStreak);
  const loaded = useStreakStore(s => s.loaded);
  const studiedToday = useStreakStore(s => s.studiedToday);
  const weekDots = useStreakStore(s => s.weekDots);
  const showNudge = loaded && !studiedToday;
  // 통계가 오기 전에 식은 칩을 한 번 보여주고 주황으로 바뀌는 깜빡임을 피한다.
  const chipMode = loaded ? streakModeFromWeek(studiedToday, weekDots) : 'done';
  const chip = HomeChipPalette[chipMode];
  const chipStyles = useMemo(() => ({
    pill: [styles.streak, { backgroundColor: chip.bg }],
    num: [styles.streakNum, { color: chip.ink }],
    word: [styles.streakWord, { color: chip.ink }],
  }), [chip]);

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
      <Animated.View style={[styles.appBar, appBar]} pointerEvents="box-none">
        {dueRemaining > 0 ? (
          <Pressable style={styles.todayBlock} onPress={onPressSchedule} hitSlop={8}>
            <View>
              <Text style={styles.todayLead}>오늘 복습할 단어가</Text>
              <View style={styles.countPhrase}>
                <Text style={styles.todayNum}>{dueRemaining}</Text>
                <Text style={styles.todayUnit}>개 남았어요</Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} style={styles.todayChevron} />
              </View>
            </View>
          </Pressable>
        ) : (
          <Text style={styles.wordmark}>Kotonoha</Text>
        )}
        <Pressable style={chipStyles.pill} onPress={onPressStreak} hitSlop={8}>
          <Ionicons name={chipMode === 'frozen' ? 'snow' : 'flame'} size={16} color={chip.icon} />
          <View style={styles.streakLabel}>
            <Text style={chipStyles.num}>{streak}일</Text>
            <Text style={chipStyles.word}>연속</Text>
          </View>
        </Pressable>
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
          pointerEvents="box-none"
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
  todayBlock: {
    flexShrink: 1,
  },
  todayLead: {
    ...Typography.bodySemiBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: -0.2,
    color: Colors.textSecondary,
  },
  countPhrase: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  todayNum: {
    ...Typography.headingBold,
    fontSize: 26,
    lineHeight: 26,
    letterSpacing: -0.8,
    color: Colors.primary,
  },
  todayUnit: {
    ...Typography.bodySemiBold,
    fontSize: 17,
    letterSpacing: -0.2,
    color: Colors.textPrimary,
  },
  todayChevron: {
    alignSelf: 'center',
    marginLeft: 4,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  streakLabel: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  streakNum: {
    ...Typography.bodyBold,
    fontSize: 14,
    letterSpacing: -0.2,
  },
  streakWord: {
    ...Typography.bodyMedium,
    fontSize: 13,
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
