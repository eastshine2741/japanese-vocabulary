import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { studyStatsApi } from '../../api/studyStatsApi';
import {
  StreakDebugState,
  getStreakDebugState,
  setStreakDebugState,
} from '../../api/debug/streakDebugOverride';
import { streakCelebrationCopy, useStreakStore } from '../../stores/streakStore';
import { useStudyStatsStore } from '../../stores/studyStatsStore';
import { Typography } from '../../theme/typography';
import type { WeekDot, WeekDotStatus } from '../../types/studyStats';

/** 오늘로 끝나는 7칸의 날짜. 마지막 칸이 오늘. */
function lastSevenDates(): string[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
}

/** 앞 6칸 상태만 주면 오늘 칸을 붙여 7칸을 만든다. */
function weekDots(past: WeekDotStatus[]): WeekDot[] {
  const dates = lastSevenDates();
  return [...past.map((status, i) => ({ date: dates[i], status })), { date: dates[6], status: 'today' as const }];
}

interface Preset {
  label: string;
  streak: number;
  hasStudiedBefore: boolean;
  past: WeekDotStatus[];
}

const CELEBRATION_PRESETS: Preset[] = [
  { label: '첫날 1일', streak: 1, hasStudiedBefore: false, past: ['none', 'none', 'none', 'none', 'none', 'none'] },
  { label: '재시작 1일', streak: 1, hasStudiedBefore: true, past: ['studied', 'studied', 'none', 'none', 'none', 'none'] },
  { label: '5일 · 프리즈 포함', streak: 5, hasStudiedBefore: true, past: ['none', 'studied', 'studied', 'studied', 'freeze', 'studied'] },
  { label: '6일 · 어제 프리즈', streak: 6, hasStudiedBefore: true, past: ['studied', 'studied', 'studied', 'studied', 'studied', 'freeze'] },
  { label: '30일', streak: 30, hasStudiedBefore: true, past: ['studied', 'studied', 'studied', 'studied', 'studied', 'studied'] },
];

const STREAK_STATES: { state: StreakDebugState; label: string }[] = [
  { state: 'off', label: '서버 값 그대로' },
  { state: 'pending', label: '오늘 아직' },
  { state: 'done', label: '오늘 완료' },
  { state: 'frozen', label: '어제 프리즈로 이어짐' },
];

/** 덮어쓴 상황으로 홈 헤더(streakStore)와 연속 학습 화면(studyStatsStore)을 다시 받는다. */
async function reloadStreak() {
  useStreakStore.getState().dismissCelebration();
  const stats = useStudyStatsStore.getState();
  stats.invalidate();
  await Promise.all([
    studyStatsApi.getHome().then(home => useStreakStore.getState().applyHomeStats(home)).catch(() => {}),
    stats.loadHome(true),
    stats.loadProfile(true),
    stats.loadHeatmap(true),
    stats.loadCalendar(true),
  ]);
}

/**
 * 개발 빌드 전용 디버그 패널. 실제 학습 기록 없이 상태 화면을 띄워 보기 위한 것이라
 * __DEV__ 가 아니면 아무것도 그리지 않는다.
 */
export const DebugOverlay = React.memo(function DebugOverlay() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const [streakState, setStreakState] = useState<StreakDebugState>(getStreakDebugState);

  const toggle = useCallback(() => setOpen(v => !v), []);

  const selectStreakState = useCallback((state: StreakDebugState) => {
    setStreakDebugState(state);
    setStreakState(state);
    reloadStreak();
  }, []);

  const runPreset = useCallback((preset: Preset) => {
    setOpen(false);
    useStreakStore.getState().showCelebration({
      ...streakCelebrationCopy(preset.streak, preset.hasStudiedBefore),
      streak: preset.streak,
      weekDots: weekDots(preset.past),
    });
  }, []);

  if (!__DEV__) return null;

  return (
    <View style={[styles.root, { bottom: insets.bottom + 92 }]} pointerEvents="box-none">
      {open && (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>오늘 연속 학습 상황</Text>
          {STREAK_STATES.map(item => (
            <StreakStateRow
              key={item.state}
              state={item.state}
              label={item.label}
              selected={item.state === streakState}
              onPress={selectStreakState}
            />
          ))}
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>연속 학습 축하</Text>
          {CELEBRATION_PRESETS.map(preset => (
            <PresetRow key={preset.label} preset={preset} onPress={runPreset} />
          ))}
        </View>
      )}
      <Pressable style={[styles.fab, open && styles.fabOpen]} onPress={toggle} hitSlop={8}>
        <Ionicons name={open ? 'close' : 'bug'} size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
});

interface PresetRowProps {
  preset: Preset;
  onPress: (preset: Preset) => void;
}

const PresetRow = React.memo(function PresetRow({ preset, onPress }: PresetRowProps) {
  const handlePress = useCallback(() => onPress(preset), [onPress, preset]);
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={handlePress}>
      <Text style={styles.rowLabel}>{preset.label}</Text>
    </Pressable>
  );
});

interface StreakStateRowProps {
  state: StreakDebugState;
  label: string;
  selected: boolean;
  onPress: (state: StreakDebugState) => void;
}

const StreakStateRow = React.memo(function StreakStateRow({ state, label, selected, onPress }: StreakStateRowProps) {
  const handlePress = useCallback(() => onPress(state), [onPress, state]);
  return (
    <Pressable style={({ pressed }) => [styles.row, styles.radioRow, pressed && styles.rowPressed]} onPress={handlePress}>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={15}
        color={selected ? '#FFFFFF' : 'rgba(255,255,255,0.45)'}
      />
      <Text style={styles.rowLabel}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: 12,
    alignItems: 'flex-end',
    gap: 8,
    zIndex: 60,
  },
  panel: {
    minWidth: 190,
    borderRadius: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(17,16,18,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  sectionTitle: {
    ...Typography.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 6,
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowLabel: {
    ...Typography.bodyMedium,
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  fab: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,16,18,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  fabOpen: {
    backgroundColor: 'rgba(17,16,18,0.94)',
  },
});
