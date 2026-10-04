import React, { useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { AppBar } from '../components/AppBar';
import { AppBottomSheetModal, AppBottomSheetModalRef, AppBottomSheetView } from '../components/bottomSheet';
import FreezeInfoSheet from '../components/studyStats/FreezeInfoSheet';
import { PrimaryButton } from '../components/PrimaryButton';
import { StreakCalendar, StreakHero, StreakStatsRow, buildStreakCalendar, streakMode } from '../components/streak';
import { FrozenPalette, StreakPalette } from '../components/streak/palette';
import { useOpenAllDeckReview } from '../hooks/useOpenAllDeckReview';
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

  const heroBg = mode === 'frozen' ? FrozenPalette.heroBg : StreakPalette.heroBg;

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const appBar = useMemo(() => <AppBar title="연속 학습" onBack={handleBack} />, [handleBack]);

  const handleStart = useOpenAllDeckReview('streak', handleBack);

  const freezeSheetRef = useRef<AppBottomSheetModalRef>(null);
  const freezeOpenRef = useRef(false);

  const handleOpenFreeze = useCallback(() => {
    freezeOpenRef.current = true;
    freezeSheetRef.current?.present();
  }, []);

  const handleCloseFreeze = useCallback(() => {
    freezeOpenRef.current = false;
    freezeSheetRef.current?.dismiss();
  }, []);

  const handleFreezeSheetChange = useCallback((index: number) => {
    freezeOpenRef.current = index >= 0;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!freezeOpenRef.current) return false;
        handleCloseFreeze();
        return true;
      });
      return () => sub.remove();
    }, [handleCloseFreeze]),
  );

  const ready = profile.data != null && heatmap.data != null;

  return (
    <SafeAreaView style={styles.safeArea} edges={ready ? [] : ['top']}>
      {!ready ? (
        <>
          {appBar}
          <ActivityIndicator color={Colors.primary} style={styles.loading} />
        </>
      ) : (
        <>
          {/* 히어로 밴드 색을 상태바·앱바까지 이어 칠해 고정 앱바와 밴드가 한 덩어리로 보이게 한다. */}
          <View style={{ paddingTop: insets.top, backgroundColor: heroBg }}>{appBar}</View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <StreakHero streak={profile.data!.currentStreak} mode={mode} />

            <View style={styles.body}>
              <StreakStatsRow
                longestStreak={profile.data!.longestStreak}
                totalStudyDays={profile.data!.totalStudyDays}
                freezeCount={profile.data!.freezeCount}
                freezeMax={profile.data!.freezeMax}
                onPressFreeze={handleOpenFreeze}
              />

              <StreakCalendar months={months} mode={mode} />
            </View>
          </ScrollView>

          <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
            <PrimaryButton label="복습 시작하기" icon="play" onPress={handleStart} />
          </View>
        </>
      )}

      <AppBottomSheetModal
        ref={freezeSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        onChange={handleFreezeSheetChange}
      >
        <AppBottomSheetView>
          <FreezeInfoSheet onConfirm={handleCloseFreeze} />
        </AppBottomSheetView>
      </AppBottomSheetModal>
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
  },
  body: {
    paddingTop: 20,
    gap: 18,
  },
  cta: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
  },
});
