import React, { useCallback, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { AppBar } from '../components/AppBar';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  AppBottomSheetModal,
  AppBottomSheetModalRef,
  AppBottomSheetView,
} from '../components/bottomSheet';
import { ForecastChart, ScheduleSummary, SelectionRuleSheet } from '../components/studySchedule';
import { useOpenAllDeckReview } from '../hooks/useOpenAllDeckReview';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useHomeChromeStore } from '../stores/homeChromeStore';
import { useStudyScheduleStore } from '../stores/studyScheduleStore';
import { Colors } from '../theme/theme';
import { Typography } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'StudySchedule'>;

/** 시뮬레이션 결과와 무관한 고정 문구다. */
const FORECAST_CAPTION = '잊어버리기 직전에 다시 보여 드려요. 매일 복습하면 외운 단어를 계속 기억할 수 있어요.';

export default function StudyScheduleScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const ruleSheetRef = useRef<AppBottomSheetModalRef>(null);
  const { status, data, load } = useStudyScheduleStore(
    useShallow(s => ({ status: s.status, data: s.data, load: s.load })),
  );
  const requestImmerse = useHomeChromeStore(s => s.requestImmerse);

  useFocusEffect(useCallback(() => { void load(true); }, [load]));

  const openRule = useCallback(() => ruleSheetRef.current?.present(), []);
  const closeRule = useCallback(() => ruleSheetRef.current?.dismiss(), []);

  // 전체 단어장을 못 열면 홈 카드 스택으로 돌아가 몰입 상태로 복습한다.
  const reviewOnHome = useCallback(() => {
    requestImmerse();
    navigation.goBack();
  }, [navigation, requestImmerse]);
  const startReview = useOpenAllDeckReview('schedule', reviewOnHome);

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppBar title="오늘의 복습 스케줄" onBack={goBack} />

      {data == null ? (
        <View style={styles.center}>
          {status === 'error' ? (
            <Text style={styles.error}>스케줄을 불러오지 못했어요</Text>
          ) : (
            <ActivityIndicator color={Colors.primary} />
          )}
        </View>
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <ScheduleSummary
              dueToday={data.dueToday}
              newToday={data.newToday}
              studiedCards={data.studiedCards}
              previewWords={data.previewWords}
              onPressRule={openRule}
            />

            {data.studiedCards > 0 && (
              <View style={styles.forecastCard}>
                <Text style={styles.forecastTitle}>1년 뒤 기억하고 있을 단어</Text>
                <Text style={styles.forecastCaption}>{FORECAST_CAPTION}</Text>
                <ForecastChart days={data.days} studiedCards={data.studiedCards} />
              </View>
            )}
          </ScrollView>

          {data.dueToday > 0 && (
            <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
              <PrimaryButton
                label={`${data.dueToday}개 복습 시작`}
                icon="play"
                onPress={startReview}
              />
            </View>
          )}

          <AppBottomSheetModal ref={ruleSheetRef} enableDynamicSizing enablePanDownToClose>
            <AppBottomSheetView>
              <SelectionRuleSheet onConfirm={closeRule} />
            </AppBottomSheetView>
          </AppBottomSheetModal>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 24,
    paddingTop: 4,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  forecastCard: {
    gap: 12,
  },
  forecastTitle: {
    ...Typography.headingBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: Colors.textPrimary,
  },
  forecastCaption: {
    ...Typography.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  cta: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
  },
});
