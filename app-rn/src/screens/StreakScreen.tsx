import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { AppBar } from '../components/AppBar';
import { PrimaryButton } from '../components/PrimaryButton';
import { StreakCalendar, StreakHero, StreakStatsRow, buildStreakCalendar, streakMode } from '../components/streak';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useStudyStatsStore } from '../stores/studyStatsStore';
import { Colors } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Streak'>;

/**
 * 홈 헤더의 연속 학습 칩에서 들어오는 상세. 기존 study-stats API 세 개(profile/home/heatmap)만
 * 쓰고, 달력 칸 상태·강도·연속 구간 띠는 heatmap 에서 클라이언트가 만든다.
 */
export default function StreakScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { profile, home, heatmap, loadProfile, loadHome, loadHeatmap } = useStudyStatsStore(
    useShallow((s) => ({
      profile: s.profile,
      home: s.home,
      heatmap: s.heatmap,
      loadProfile: s.loadProfile,
      loadHome: s.loadHome,
      loadHeatmap: s.loadHeatmap,
    })),
  );

  useFocusEffect(
    useCallback(() => {
      if (profile.status === 'idle' || profile.staleAt > 0) loadProfile(profile.staleAt > 0);
      if (home.status === 'idle' || home.staleAt > 0) loadHome(home.staleAt > 0);
      if (heatmap.status === 'idle' || heatmap.staleAt > 0) loadHeatmap(heatmap.staleAt > 0);
    }, [
      profile.status, profile.staleAt, loadProfile,
      home.status, home.staleAt, loadHome,
      heatmap.status, heatmap.staleAt, loadHeatmap,
    ]),
  );

  const days = heatmap.data?.days;
  const months = useMemo(() => buildStreakCalendar(days ?? []), [days]);
  const mode = useMemo(() => streakMode(home.data?.studiedToday ?? false, days ?? []), [home.data, days]);

  const handleStart = useCallback(() => {
    // 홈 스택이 곧 복습이다 — 뒤로 가면 바로 오늘의 카드로 돌아간다.
    navigation.goBack();
  }, [navigation]);

  const ready = profile.data != null && heatmap.data != null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppBar title="연속 학습" onBack={() => navigation.goBack()} />

      {!ready ? (
        <ActivityIndicator color={Colors.primary} style={styles.loading} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 12 }]}
          showsVerticalScrollIndicator={false}
        >
          <StreakHero streak={profile.data!.currentStreak} mode={mode} />

          <View style={styles.body}>
            <StreakStatsRow
              longestStreak={profile.data!.longestStreak}
              totalStudyDays={profile.data!.totalStudyDays}
              freezeCount={profile.data!.freezeCount}
              freezeMax={profile.data!.freezeMax}
            />

            <StreakCalendar months={months} mode={mode} />

            {mode !== 'done' && (
              <View style={styles.cta}>
                <PrimaryButton label="복습 시작하기" icon="play" onPress={handleStart} />
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loading: {
    marginTop: 64,
  },
  content: {
    flexGrow: 1,
  },
  body: {
    paddingTop: 20,
    gap: 18,
  },
  cta: {
    paddingHorizontal: 20,
  },
});
