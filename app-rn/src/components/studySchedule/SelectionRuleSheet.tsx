import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { PrimaryButton } from '../PrimaryButton';

/** 새 단어에 계속 '알고 있음'을 눌렀을 때의 간격 — FSRS 기본값에서 온 고정 예시다. */
const INTERVAL_EXAMPLE = ['10분', '6일', '19일', '2달'];

const STEPS = [
  {
    title: '단어마다 기억할 확률을 계산해요',
    desc: "복습할 때 누른 버튼(다시·어려움·알고 있음·쉬움)과 마지막 복습 뒤 지난 날짜로, 지금 이 단어를 떠올릴 확률을 단어별로 따로 계산해요.",
  },
  {
    title: '90% 아래로 내려가는 날이 복습일이에요',
    desc: '더 일찍 보면 이미 아는 단어에 시간을 쓰고, 더 늦으면 잊어버려요. 그래서 잊어버리기 직전에 다시 보여 줘요.',
  },
  {
    title: '잘 기억할수록 다음 복습이 멀어져요',
    desc: "맞힐 때마다 확률이 더 천천히 떨어져서 간격이 길어져요. '다시'를 누르면 간격이 다시 짧아져요.",
  },
];

interface Props {
  onConfirm: () => void;
}

/** 요약 줄의 i 버튼에서 여는 시트 — 오늘 목록을 고른 기준 설명. */
function SelectionRuleSheet({ onConfirm }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.title}>오늘 복습할 단어는 이렇게 골라요</Text>
          <Text style={styles.lead}>
            기억 모델이 단어마다 지금 떠올릴 확률을 계산해서, 그 확률이 90% 아래로 내려가기 직전인
            단어만 오늘 목록에 넣어요.
          </Text>
        </View>

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

      <View style={styles.ctaWrap}>
        <PrimaryButton label="확인" onPress={onConfirm} />
      </View>
    </View>
  );
}

function IntervalExample() {
  return (
    <>
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
      <Text style={styles.intervalLabel}>새 단어에 계속 '알고 있음'을 누를 때의 간격</Text>
    </>
  );
}

export default React.memo(SelectionRuleSheet);

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
  },
  body: {
    gap: 20,
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  head: {
    gap: 8,
  },
  title: {
    ...Typography.headingBold,
    fontSize: 20,
    lineHeight: 26,
    color: Colors.textPrimary,
  },
  lead: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  steps: {
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSubtle,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.stateReviewBg,
  },
  badgeNum: {
    ...Typography.bodyBold,
    fontSize: 12,
    color: Colors.primary,
  },
  textCol: {
    flex: 1,
    gap: 5,
  },
  stepTitle: {
    ...Typography.bodyBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
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
  intervalLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  ctaWrap: {
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
});
