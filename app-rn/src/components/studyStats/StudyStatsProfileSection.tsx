import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';
import { useStudyStatsStore } from '../../stores/studyStatsStore';
import { Colors } from '../../theme/theme';
import { HeatmapDay, WeeklyChartDay } from '../../types/studyStats';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export default React.memo(function StudyStatsProfileSection() {
  const { profile, heatmap, loadProfile, loadHeatmap } = useStudyStatsStore(
    useShallow((s) => ({
      profile: s.profile,
      heatmap: s.heatmap,
      loadProfile: s.loadProfile,
      loadHeatmap: s.loadHeatmap,
    })),
  );

  useEffect(() => {
    if (profile.status === 'idle' || profile.staleAt > 0) {
      loadProfile(profile.staleAt > 0);
    }
    if (heatmap.status === 'idle' || heatmap.staleAt > 0) {
      loadHeatmap(heatmap.staleAt > 0);
    }
  }, [profile.status, profile.staleAt, heatmap.status, heatmap.staleAt, loadProfile, loadHeatmap]);

  const weeklyChart = useMemo<WeeklyChartDay[] | null>(() => {
    if (!heatmap.data) return null;
    return deriveCurrentWeek(heatmap.data.days);
  }, [heatmap.data]);

  const currentStreak = profile.data?.currentStreak ?? 0;
  const longestStreak = profile.data?.longestStreak ?? 0;
  const totalStudyDays = profile.data?.totalStudyDays ?? 0;
  const dailyGoal = profile.data?.dailyGoal ?? 10;
  const weeklyEmpty = !weeklyChart || weeklyChart.every((d) => d.reviewCount === 0 && !d.freezeUsed);

  return (
    <View style={styles.wrapper}>
      <View style={styles.achievements}>
        <Achievement
          iconName="flame"
          iconColor={Colors.streakFlame}
          value={currentStreak}
          label="현재 연속"
        />
        <Achievement
          iconName="trophy"
          iconColor="#FFB300"
          value={longestStreak}
          label="최장 기록"
        />
        <Achievement
          iconName="calendar"
          iconColor={Colors.primary}
          value={totalStudyDays}
          label="총 학습일"
        />
      </View>

      <View style={styles.weeklyCard}>
        <View style={styles.wkHeader}>
          <Text style={styles.wkTitle}>이번 주 활동</Text>
          <View style={styles.wkGoal}>
            <Ionicons name="locate" size={11} color={Colors.textMuted} />
            <Text style={styles.wkGoalText}>목표 {dailyGoal}장</Text>
          </View>
        </View>
        {weeklyEmpty || !weeklyChart ? (
          <WeeklyEmpty />
        ) : (
          <>
            <WeeklyChart days={weeklyChart} dailyGoal={dailyGoal} />
            <View style={styles.daysRow}>
              {weeklyChart.map((day, i) => (
                <DayLabel key={day.date} index={i} day={day} dailyGoal={dailyGoal} />
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
});

const WeeklyEmpty = React.memo(function WeeklyEmpty() {
  return (
    <View style={styles.emptyWk}>
      <Ionicons name="calendar-outline" size={28} color={Colors.textMuted} />
      <Text style={styles.emptyWkMsg}>이번 주 학습 기록이 없어요</Text>
      <Text style={styles.emptyWkHint}>오늘 첫 카드를 학습해보세요</Text>
    </View>
  );
});

/**
 * Derive Mon-Sun of the current week from the heatmap (which ends at today's
 * study date). Days within the week that fall after today are returned with
 * reviewCount=0/freezeUsed=false (future slots).
 */
function deriveCurrentWeek(days: HeatmapDay[]): WeeklyChartDay[] {
  if (days.length === 0) return [];
  const todayStr = days[days.length - 1].date;
  const today = parseISODate(todayStr);
  const daysFromMonday = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);

  const byDate = new Map(days.map((d) => [d.date, d]));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = formatISODate(d);
    const hm = byDate.get(iso);
    return {
      date: iso,
      reviewCount: hm?.reviewCount ?? 0,
      freezeUsed: hm?.freezeUsed ?? false,
      isToday: iso === todayStr,
    };
  });
}

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const Achievement = React.memo(function Achievement({
  iconName,
  iconColor,
  value,
  label,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: number;
  label: string;
}) {
  const muted = value === 0;
  return (
    <View style={styles.achievement}>
      <Ionicons name={iconName} size={16} color={iconColor} />
      <Text style={[styles.achievementValue, muted && styles.achievementValueMuted]}>{value}</Text>
      <Text style={styles.achievementLabel}>{label}</Text>
    </View>
  );
});

const CHART_HEIGHT = 110;
const GOAL_LINE_OFFSET_RATIO = 0.6; // goal line ~y=44 of 110-height area (matches Pencil)
const FUTURE_BAR_HEIGHT = 6;
const MIN_BAR_HEIGHT = 4;

function WeeklyChart({ days, dailyGoal }: { days: WeeklyChartDay[]; dailyGoal: number }) {
  const goal = Math.max(1, dailyGoal);
  // Visual scale: goal sits at GOAL_LINE_OFFSET_RATIO of chart height.
  // So 1.0 visual height = goal / GOAL_LINE_OFFSET_RATIO units.
  const visualMax = Math.max(goal / GOAL_LINE_OFFSET_RATIO, ...days.map((d) => d.reviewCount));
  const goalLineBottom = (goal / visualMax) * CHART_HEIGHT;

  return (
    <View style={styles.chartBox}>
      <View style={styles.bars}>
        {days.map((day) => (
          <Bar key={day.date} day={day} visualMax={visualMax} dailyGoal={goal} />
        ))}
      </View>
      <View style={[styles.goalLine, { bottom: goalLineBottom }]} />
      <Text style={[styles.goalLabel, { bottom: goalLineBottom - 5 }]}>{goal}</Text>
    </View>
  );
}

const Bar = React.memo(function Bar({
  day,
  visualMax,
  dailyGoal,
}: {
  day: WeeklyChartDay;
  visualMax: number;
  dailyGoal: number;
}) {
  // Future day: no review, no freeze, not today, and reviewCount=0 — show small gray stub
  // (Today is "in progress" so still rendered as a bar.)
  const isFuture = !day.isToday && day.reviewCount === 0 && !day.freezeUsed;

  if (isFuture) {
    return (
      <View style={styles.barCol}>
        <View style={[styles.barFuture]} />
      </View>
    );
  }

  if (day.freezeUsed && day.reviewCount === 0) {
    return (
      <View style={styles.barCol}>
        <Ionicons name="snow" size={14} color={Colors.primary} />
        <View style={styles.barFreezeStub} />
      </View>
    );
  }

  const ratio = visualMax === 0 ? 0 : day.reviewCount / visualMax;
  const height = Math.max(MIN_BAR_HEIGHT, Math.round(CHART_HEIGHT * ratio));
  const reachedGoal = day.reviewCount >= dailyGoal;
  const color = reachedGoal
    ? Colors.accentSecondary
    : Colors.primary;
  const opacity = day.isToday || reachedGoal ? 1 : 0.55;
  return (
    <View style={styles.barCol}>
      <View style={[styles.bar, { height, backgroundColor: color, opacity }]} />
    </View>
  );
});

const DayLabel = React.memo(function DayLabel({
  index,
  day,
  dailyGoal,
}: {
  index: number;
  day: WeeklyChartDay;
  dailyGoal: number;
}) {
  const label = WEEKDAY_LABELS[index] ?? '';
  const valueText = day.freezeUsed && day.reviewCount === 0
    ? '프리즈'
    : day.reviewCount > 0
    ? String(day.reviewCount)
    : '-';
  const reachedGoal = day.reviewCount >= dailyGoal;
  const valueColor = reachedGoal
    ? Colors.accentSecondary
    : day.freezeUsed && day.reviewCount === 0
    ? Colors.primary
    : day.isToday
    ? Colors.primary
    : day.reviewCount > 0
    ? Colors.textSecondary
    : Colors.textMuted;
  return (
    <View style={styles.dayCol}>
      <Text style={[styles.dayValue, { color: valueColor }]}>{valueText}</Text>
      <Text
        style={[
          styles.dayWeek,
          day.isToday && styles.dayWeekToday,
          reachedGoal && styles.dayWeekGoal,
        ]}
      >
        {day.isToday ? '오늘' : label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 24 },

  achievements: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 16,
  },
  achievement: {
    flex: 1,
    flexDirection: 'column',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  achievementValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  achievementValueMuted: {
    color: Colors.textSecondary,
  },
  achievementLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  emptyWk: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  emptyWkMsg: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  emptyWkHint: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  weeklyCard: { gap: 14 },
  wkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wkTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  wkGoal: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wkGoalText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
  },

  chartBox: {
    height: CHART_HEIGHT + 8,
    position: 'relative',
    paddingTop: 8,
    paddingRight: 18,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: CHART_HEIGHT,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: CHART_HEIGHT,
    gap: 2,
  },
  bar: {
    width: '70%',
    borderRadius: 4,
  },
  barFreezeStub: {
    width: '70%',
    height: FUTURE_BAR_HEIGHT,
    backgroundColor: Colors.border,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barFuture: {
    width: '70%',
    height: FUTURE_BAR_HEIGHT,
    backgroundColor: Colors.border,
    borderRadius: 3,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 18,
    height: 1,
    backgroundColor: Colors.accentSecondary,
    opacity: 0.5,
  },
  goalLabel: {
    position: 'absolute',
    right: 0,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.accentSecondary,
    fontVariant: ['tabular-nums'],
  },

  daysRow: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 18,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  dayValue: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dayWeek: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  dayWeekToday: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dayWeekGoal: {
    color: Colors.accentSecondary,
    fontWeight: '700',
  },
});
