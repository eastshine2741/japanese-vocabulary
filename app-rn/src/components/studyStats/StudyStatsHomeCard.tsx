import React, { useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useShallow } from 'zustand/react/shallow';
import { useStudyStatsStore } from '../../stores/studyStatsStore';
import { Colors } from '../../theme/theme';
import { TabParamList } from '../../navigation/AppNavigator';
import { WeekDot } from '../../types/studyStats';

type Nav = BottomTabNavigationProp<TabParamList>;

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export default React.memo(function StudyStatsHomeCard() {
  const navigation = useNavigation<Nav>();
  const { home, loadHome } = useStudyStatsStore(
    useShallow((s) => ({ home: s.home, loadHome: s.loadHome })),
  );

  useEffect(() => {
    if (home.status === 'idle' || home.staleAt > 0) {
      loadHome(home.staleAt > 0);
    }
  }, [home.status, home.staleAt, loadHome]);

  const handlePress = useCallback(() => {
    navigation.navigate('Words');
  }, [navigation]);

  if (home.status !== 'loaded' || !home.data) return null;

  const { currentStreak, weekDots } = home.data;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handlePress} style={styles.card}>
      <View style={styles.left}>
        <Ionicons name="flame" size={26} color={Colors.streakFlame} />
        <View style={styles.streakTxt}>
          <View style={styles.streakNumRow}>
            <Text style={styles.streakNum}>{currentStreak}</Text>
            <Text style={styles.streakUnit}>일 연속</Text>
          </View>
        </View>
      </View>
      <View style={styles.weekDots}>
        {weekDots.map((dot, i) => (
          <DotCell key={dot.date} label={WEEKDAY_LABELS[i] ?? ''} dot={dot} />
        ))}
      </View>
    </TouchableOpacity>
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
    return <Ionicons name="snow" size={10} color={Colors.primary} />;
  }
  if (dot.status === 'studied') {
    return <View style={[styles.dot, { backgroundColor: Colors.stateReview }]} />;
  }
  if (dot.status === 'today') {
    return <View style={[styles.dot, styles.dotTodayRing]} />;
  }
  return <View style={[styles.dot, styles.dotEmpty]} />;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 8,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakTxt: { flexDirection: 'column', gap: 1 },
  streakNumRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakNum: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  streakUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  weekDots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayCol: { flexDirection: 'column', alignItems: 'center', gap: 4, width: 14 },
  dayLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  dayLabelToday: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dotTodayRing: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
});
