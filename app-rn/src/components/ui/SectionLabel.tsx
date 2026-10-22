import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';

/** 시트·폼 안에서 칩·옵션 묶음 위에 붙는 작은 라벨. */
export const SectionLabel = React.memo(function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
});

const styles = StyleSheet.create({
  label: {
    ...Typography.bodyBold,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
});
