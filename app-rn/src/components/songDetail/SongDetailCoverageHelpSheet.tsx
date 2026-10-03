import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

interface HelpStep {
  title: string;
  desc: string;
}

const HELP_STEPS: HelpStep[] = [
  {
    title: '장기 기억 중인 단어 고르기',
    desc: '7일 뒤에 떠올릴 확률이 90% 이상이면, 그 단어는 확실히 외운 것으로 봐요.',
  },
  {
    title: '이해한 가사 세기',
    desc: '한 줄에 나오는 단어를 모두 외웠다면, 그 줄은 이해한 가사로 봐요.',
  },
];

interface SongDetailCoverageHelpSheetProps {
  onConfirm: () => void;
}

export const SongDetailCoverageHelpSheet = React.memo(function SongDetailCoverageHelpSheet({
  onConfirm,
}: SongDetailCoverageHelpSheetProps) {
  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.title}>이해도는 이렇게 계산해요</Text>
          <Text style={styles.lead}>전체 가사 중 뜻을 아는 줄의 비율이에요.</Text>
        </View>

        <View style={styles.steps}>
          {HELP_STEPS.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.badge}>
                <Text style={styles.badgeNum}>{index + 1}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={onConfirm}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="확인"
        >
          <Text style={styles.confirmLabel}>확인</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

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
    color: Colors.textPrimary,
    fontSize: 20,
    lineHeight: 26,
  },
  lead: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  steps: {
    gap: 14,
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
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.coverageTrack,
  },
  badgeNum: {
    ...Typography.bodyBold,
    color: Colors.coverageAccent,
    fontSize: 12,
  },
  stepText: {
    flex: 1,
    gap: 5,
  },
  stepTitle: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  stepDesc: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  ctaWrap: {
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  confirmButton: {
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  confirmLabel: {
    ...Typography.bodySemiBold,
    color: '#FFFFFF',
    fontSize: 14,
  },
});
