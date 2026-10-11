import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { navigate } from '../../navigation/navigationRef';
import { useRewardCardStore } from '../../stores/rewardCardStore';
import { isDevBuild } from '../../utils/buildEnv';
import { preferenceStorage } from '../../utils/preferenceStorage';

/** 곡 카드 상세에 들어온 순간 카드 규칙 설명을 띄웠는지. */
export type IntroDecision = 'waiting' | 'checking' | 'shown' | 'seen' | 'revealing';

const DECISION_LABEL: Record<IntroDecision, string> = {
  waiting: '대기 (카드 없음·발급 전)',
  checking: '확인 중',
  shown: '띄움',
  seen: '건너뜀 (본 적 있음)',
  revealing: '건너뜀 (다른 연출 중)',
};

interface DebugState {
  last: { cardId: string; title: string; decision: IntroDecision } | null;
}

const useIntroDebugStore = create<DebugState>(() => ({ last: null }));

/** 곡 카드 상세가 이번 진입의 판정을 남긴다. 오버레이가 상세 밖에서도 마지막 판정을 보여 준다. */
export function reportIntroDecision(cardId: string, title: string, decision: IntroDecision): void {
  if (isDevBuild) useIntroDebugStore.setState({ last: { cardId, title, decision } });
}

/** 개발 빌드 전용. 카드 규칙 설명을 처음 띄울지 가르는 값과 마지막 판정을 앱 어디서든 보여 주고, 기록을 지우거나 바로 띄운다. */
export const CardIntroDebugOverlay = React.memo(function CardIntroDebugOverlay() {
  const insets = useSafeAreaInsets();
  const seenInStore = useRewardCardStore((s) => s.wearIntroSeen);
  const revealing = useRewardCardStore((s) => s.active !== null);
  const firstIssued = useRewardCardStore((s) => s.songCards.find((c) => c.issued === true) ?? null);
  const resetWearIntroSeen = useRewardCardStore((s) => s.resetWearIntroSeen);
  const last = useIntroDebugStore((s) => s.last);
  // 스토어 값은 앱 실행 중 기억이라, 기기에 남은 값과 따로 본다.
  const [seenOnDevice, setSeenOnDevice] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  const refreshDevice = useCallback(() => {
    preferenceStorage.getCardWearIntroSeen().then(setSeenOnDevice, () => setSeenOnDevice(null));
  }, []);
  useEffect(refreshDevice, [refreshDevice, seenInStore]);

  const targetId = last?.cardId ?? firstIssued?.id ?? null;
  const handleToggle = useCallback(() => setOpen((v) => !v), []);
  const handleReset = useCallback(() => {
    resetWearIntroSeen();
    setTimeout(refreshDevice, 100);
  }, [refreshDevice, resetWearIntroSeen]);
  const handleShow = useCallback(() => {
    if (targetId) navigate('RewardCardReveal', { kind: 'song', cardId: targetId, intro: true });
  }, [targetId]);

  if (!isDevBuild || revealing) return null;
  return (
    <View style={[styles.box, { top: insets.top + 24 }]}>
      <Pressable onPress={handleToggle} hitSlop={6}>
        <Text style={styles.title}>
          카드 설명 {open ? '▾' : '▸'} 본 적 <Text style={seenInStore ? styles.on : styles.off}>{seenInStore ? '있음' : '없음'}</Text>
        </Text>
      </Pressable>
      {open && (
        <>
          <Row label="본 적 (스토어)" value={seenInStore} />
          <Row label="본 적 (기기)" value={seenOnDevice} />
          <Row label="다른 연출 중" value={revealing} />
          <Text style={styles.row} numberOfLines={2}>
            마지막 진입: {last ? `${last.title} → ${DECISION_LABEL[last.decision]}` : '없음'}
          </Text>
          <View style={styles.buttons}>
            <Pressable onPress={handleReset} style={styles.button}>
              <Text style={styles.buttonText}>기록 지우기</Text>
            </Pressable>
            <Pressable onPress={handleShow} disabled={!targetId} style={[styles.button, !targetId && styles.disabled]}>
              <Text style={styles.buttonText}>지금 띄우기</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
});

const Row = React.memo(function Row({ label, value }: { label: string; value: boolean | null }) {
  return (
    <Text style={styles.row}>
      {label}: <Text style={value ? styles.on : styles.off}>{value == null ? '?' : value ? '예' : '아니오'}</Text>
    </Text>
  );
});

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    left: 8,
    maxWidth: 230,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
    borderRadius: 8,
    backgroundColor: '#000000B3',
  },
  title: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  row: { color: '#FFFFFFB3', fontSize: 10 },
  on: { color: '#7CE38B', fontWeight: '700' },
  off: { color: '#FF8A80', fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 6, marginTop: 4 },
  button: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FFFFFF26' },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
