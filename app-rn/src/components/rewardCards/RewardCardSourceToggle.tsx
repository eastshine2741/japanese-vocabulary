import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import { isDevBuild } from '../../utils/buildEnv';

/** 개발 빌드 전용. 카드 화면을 더미(모든 등급 견본)와 서버 응답 중 무엇으로 그릴지 바꾼다. */
export const RewardCardSourceToggle = React.memo(function RewardCardSourceToggle() {
  const insets = useSafeAreaInsets();
  const source = useRewardCardStore((s) => s.source);
  const serverStatus = useRewardCardStore((s) => s.serverStatus);
  // 획득 연출을 가리지 않게 연출 중엔 숨긴다.
  const revealing = useRewardCardStore((s) => s.active !== null);
  const handlePress = useCallback(() => {
    const store = useRewardCardStore.getState();
    store.setSource(store.source === 'server' ? 'dummy' : 'server');
  }, []);

  if (!isDevBuild || revealing) return null;
  const label = source === 'dummy' ? '카드: 더미' : serverStatus === 'error' ? '카드: 서버 (오류)' : '카드: 서버';
  return (
    <Pressable onPress={handlePress} hitSlop={6} style={[styles.chip, { top: insets.top + 2 }]}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#000000A6',
  },
  text: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
