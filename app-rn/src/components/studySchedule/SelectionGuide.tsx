import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

/** 새 단어에 계속 '알고 있음'을 눌렀을 때의 간격 — FSRS 기본값에서 온 고정 예시다. */
const INTERVAL_EXAMPLE = ['10분', '6일', '19일', '2달'];

const STEPS = [
  {
    title: '단어마다 기억할 확률을 계산해요',
    desc: '복습 때 누른 버튼과 그 뒤 지난 날짜로 계산해요.',
  },
  {
    title: '90% 아래로 내려가는 날이 복습일이에요',
    desc: '더 일찍 보면 아는 단어에 시간을 쓰고, 더 늦으면 잊어버려요.',
  },
  {
    title: '잘 기억할수록 다음 복습이 멀어져요',
    desc: "맞힐수록 확률이 천천히 떨어져 간격이 길어지고, '다시'를 누르면 짧아져요.",
  },
];

/** 오늘 목록을 고른 기준 — 숫자·예보보다 한 단계 낮은 참고 설명이라 옅은 카드에 담는다. */
export const SelectionGuide = React.memo(function SelectionGuide() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>복습할 단어는 이렇게 골라요</Text>

      <View style={styles.steps}>
        {STEPS.map((step, i) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.badge}>
              <Text style={styles.badgeNum}>{i + 1}</Text>
            </View>
            <View style={styles.textCol}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
              {i === STEPS.length - 1 && <IntervalExample />}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

function IntervalExample() {
  return (
    <View style={styles.intervalRow}>
      {INTERVAL_EXAMPLE.map((value, i) => (
        <React.Fragment key={value}>
          {i > 0 && <Ionicons name="arrow-forward" size={12} color={Colors.textMuted} />}
          <View style={styles.intervalChip}>
            <Text style={styles.intervalValue}>{value}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
  },
  title: {
    ...Typography.headingBold,
    fontSize: 15,
    letterSpacing: -0.3,
    color: Colors.textPrimary,
  },
  steps: {
    gap: 14,
  },
  step: {
    flexDirection: 'row',
    gap: 10,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  badgeNum: {
    ...Typography.bodyBold,
    fontSize: 11,
    color: Colors.primary,
  },
  textCol: {
    flex: 1,
    gap: 5,
  },
  stepTitle: {
    ...Typography.bodyBold,
    fontSize: 13.5,
    color: Colors.textPrimary,
  },
  stepDesc: {
    fontSize: 12.5,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  intervalChip: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: Colors.background,
  },
  intervalValue: {
    ...Typography.bodySemiBold,
    fontSize: 12,
    color: Colors.textPrimary,
  },
});
