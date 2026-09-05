import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { WeekDot } from '../../types/studyStats';

const APP_BAR_HEIGHT = 52;
const STREAK_BANNER_HEIGHT = 67;
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

/** 곡 진입 복습과 다르게 홈 최초 진입은 스트릭 배너까지 펼친다. */
export const HOME_HEADER_CONTENT_HEIGHT = APP_BAR_HEIGHT + STREAK_BANNER_HEIGHT;

export interface HomeExpandedHeaderProps {
  streak: number;
  weekDots: WeekDot[];
  /** 0 = 펼침(H5), 1 = 몰입(H1). */
  immerse: Animated.Value;
}

/** H5 헤더 — 상태바 여백 + 워드마크 앱바 + 스트릭 배너. 위쪽 블록부터 먼저 빠진다. */
export const HomeExpandedHeader = React.memo(function HomeExpandedHeader({
  streak,
  weekDots,
  immerse,
}: HomeExpandedHeaderProps) {
  const insets = useSafeAreaInsets();
  const height = insets.top + HOME_HEADER_CONTENT_HEIGHT;

  const shell = {
    transform: [{
      translateY: immerse.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -height],
      }),
    }],
  };
  const appBar = {
    opacity: immerse.interpolate({
      inputRange: [0, 0.55],
      outputRange: [1, 0],
      extrapolate: 'clamp' as const,
    }),
    transform: [{
      translateY: immerse.interpolate({
        inputRange: [0, 0.6],
        outputRange: [0, -18],
        extrapolate: 'clamp' as const,
      }),
    }],
  };
  const banner = {
    opacity: immerse.interpolate({
      inputRange: [0.15, 0.85],
      outputRange: [1, 0],
      extrapolate: 'clamp' as const,
    }),
    transform: [{
      translateY: immerse.interpolate({
        inputRange: [0, 0.85],
        outputRange: [0, -10],
        extrapolate: 'clamp' as const,
      }),
    }],
  };

  return (
    <Animated.View style={[styles.shell, { height }, shell]} pointerEvents="none">
      <View style={{ height: insets.top }} />
      <Animated.View style={[styles.appBar, appBar]}>
        <Text style={styles.wordmark}>Kotonoha</Text>
      </Animated.View>
      <Animated.View style={[styles.banner, banner]}>
        {weekDots.length > 0 && (
          <View style={styles.bannerRow}>
            <View style={styles.streakLeft}>
              <Ionicons name="flame" size={26} color={Colors.streakFlame} />
              <View style={styles.streakNumRow}>
                <Text style={styles.streakNum}>{streak}</Text>
                <Text style={styles.streakUnit}>일 연속</Text>
              </View>
            </View>
            <View style={styles.weekDots}>
              {weekDots.map((dot, i) => (
                <DotCell key={dot.date} label={WEEKDAY_LABELS[i] ?? ''} dot={dot} />
              ))}
            </View>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
});

const DotCell = React.memo(function DotCell({ label, dot }: { label: string; dot: WeekDot }) {
  const isToday = dot.status === 'today';
  return (
    <View style={styles.dayCol}>
      <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label}</Text>
      <DotMark dot={dot} />
    </View>
  );
});

function DotMark({ dot }: { dot: WeekDot }) {
  if (dot.status === 'freeze') {
    return <Ionicons name="snow" size={10} color={DOT_FREEZE} />;
  }
  if (dot.status === 'studied') {
    return <View style={[styles.dot, styles.dotStudied]} />;
  }
  if (dot.status === 'today') {
    return <View style={[styles.dot, styles.dotToday]} />;
  }
  return <View style={[styles.dot, styles.dotEmpty]} />;
}

const DOT_STUDIED = '#10B981';
const DOT_FREEZE = '#52B788';

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
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  wordmark: {
    ...Typography.headingBold,
    fontSize: 21,
    letterSpacing: 0.2,
    color: Colors.textPrimary,
  },
  banner: {
    height: STREAK_BANNER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakNum: {
    ...Typography.bodyExtraBold,
    fontSize: 24,
    color: Colors.textPrimary,
  },
  streakUnit: {
    ...Typography.bodySemiBold,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  weekDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayCol: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    width: 14,
  },
  dayLabel: {
    ...Typography.bodyMedium,
    fontSize: 9,
    color: Colors.textMuted,
  },
  dayLabelToday: {
    ...Typography.bodyBold,
    color: DOT_FREEZE,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dotStudied: {
    backgroundColor: DOT_STUDIED,
  },
  dotToday: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: DOT_FREEZE,
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
