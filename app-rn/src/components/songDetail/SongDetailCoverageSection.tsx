import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import type { SongCoverageDto } from '../../types/song';

interface SongDetailCoverageSectionProps {
  coverage: SongCoverageDto;
  onHelpPress: () => void;
}

/**
 * 이해도는 단어가 아니라 가사 줄 기준이다 — 한 줄의 단어를 전부 장기기억으로 만들어야 그 줄이
 * 채워진다. 계산식은 도움말 시트가 설명한다.
 */
export const SongDetailCoverageSection = React.memo(function SongDetailCoverageSection({
  coverage,
  onHelpPress,
}: SongDetailCoverageSectionProps) {
  const totalLines = Math.max(0, coverage.totalLines);
  const knownLines = Math.min(Math.max(0, coverage.knownLines), totalLines);
  const ratio = totalLines > 0 ? knownLines / totalLines : 0;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.headMeta}>
          <Text style={styles.eyebrow}>전체 가사 중</Text>
          <Pressable
            style={styles.helpButton}
            onPress={onHelpPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="이해도 계산 방식"
          >
            <Feather name="help-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.statement}>
          <Text style={styles.coverageValue}>{Math.round(ratio * 100)}%</Text>
          <Text style={styles.statementTail}>를 이해하고 있어요</Text>
        </View>
      </View>

      <View style={styles.meter}>
        <View style={styles.track}>
          {ratio > 0 && <View style={[styles.knownSegment, { flex: ratio }]} />}
          {ratio < 1 && <View style={{ flex: 1 - ratio }} />}
        </View>
        <View style={styles.counts}>
          <View style={styles.dot} />
          <Text style={styles.countLabel}>이해하는 가사</Text>
          <Text style={styles.countValue}>{knownLines} / {totalLines}줄</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: 16,
  },
  head: {
    gap: 5,
  },
  headMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    ...Typography.bodySemiBold,
    color: Colors.textMuted,
    fontSize: 13,
  },
  helpButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statement: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverageValue: {
    ...Typography.headingBold,
    color: Colors.coverageAccent,
    fontSize: 28,
    lineHeight: 36,
  },
  statementTail: {
    ...Typography.headingBold,
    color: Colors.textPrimary,
    fontSize: 28,
    lineHeight: 36,
  },
  meter: {
    gap: 10,
  },
  track: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 9999,
    backgroundColor: Colors.coverageTrack,
    overflow: 'hidden',
  },
  knownSegment: {
    backgroundColor: Colors.coverageAccent,
  },
  counts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 9999,
    backgroundColor: Colors.coverageAccent,
  },
  countLabel: {
    ...Typography.body,
    color: Colors.textMuted,
    fontSize: 12,
  },
  countValue: {
    ...Typography.bodyBold,
    color: Colors.textPrimary,
    fontSize: 13,
  },
});
