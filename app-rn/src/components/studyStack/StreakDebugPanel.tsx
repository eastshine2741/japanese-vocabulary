import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { streakToastContent, StreakToastContent, useStreakStore } from '../../stores/streakStore';
import { Typography } from '../../theme/typography';

export interface StreakDebugPanelProps {
  /** 홈: 완료 배너는 몰입 크롬 위에만 보이므로 배너 버튼이 먼저 몰입으로 들어간다. 곡 복습처럼 항상 크롬이 떠 있으면 생략. */
  onRequestImmerse?: () => void;
}

/**
 * dev 빌드 전용 — 화면 오른쪽 아래에 떠서 '오늘 아직' 말풍선과 첫 rating 완료 배너를 서버 상태와
 * 무관하게 띄운다. 홈을 다시 불러오면(홈탭 재탭) 서버 값으로 되돌아간다.
 */
export const StreakDebugPanel = React.memo(function StreakDebugPanel({ onRequestImmerse }: StreakDebugPanelProps) {
  const showNudge = useStreakStore(s => s.loaded && !s.studiedToday);
  const currentStreak = useStreakStore(s => s.currentStreak);

  const toggleNudge = useCallback(() => {
    // 켜기 = 홈 통계를 받았고 오늘 아직 안 했다, 끄기 = 오늘 했다.
    useStreakStore.setState({ loaded: true, studiedToday: showNudge });
  }, [showNudge]);

  const showToast = useCallback((toast: StreakToastContent) => {
    onRequestImmerse?.();
    // 이미 떠 있는 배너가 있으면 내리고 새로 띄운다.
    useStreakStore.setState({ toast: null });
    requestAnimationFrame(() => useStreakStore.setState({ toast }));
  }, [onRequestImmerse]);

  const showContinue = useCallback(
    () => showToast(streakToastContent(Math.max(2, currentStreak + 1), true)),
    [currentStreak, showToast],
  );
  const showReturn = useCallback(() => showToast(streakToastContent(1, true)), [showToast]);
  const showFirst = useCallback(() => showToast(streakToastContent(1, false)), [showToast]);

  return (
    <View style={styles.panel} pointerEvents="box-none">
      <DebugButton label={showNudge ? '말풍선 끄기' : '말풍선 켜기'} onPress={toggleNudge} />
      <DebugButton label="배너·이어감" onPress={showContinue} />
      <DebugButton label="배너·복귀" onPress={showReturn} />
      <DebugButton label="배너·첫날" onPress={showFirst} />
    </View>
  );
});

interface DebugButtonProps {
  label: string;
  onPress: () => void;
}

const DebugButton = React.memo(function DebugButton({ label, onPress }: DebugButtonProps) {
  return (
    <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    alignItems: 'flex-end',
    gap: 6,
  },
  button: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  buttonPressed: {
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  buttonText: {
    ...Typography.bodySemiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});
