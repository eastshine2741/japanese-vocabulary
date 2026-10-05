import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Dimens } from '../../theme/theme';
import { fontStyle } from '../../theme/typography';

interface Props {
  main: string;
  sub?: string;
  count: number;
}

export const KaraokeSectionHeader = React.memo(function KaraokeSectionHeader({
  main,
  sub,
  count,
}: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.label}>
        <Text style={styles.main} numberOfLines={1}>{main}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      <Text style={styles.count}>{count}곡</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 6,
    paddingHorizontal: Dimens.screenPadding,
    backgroundColor: Colors.surface,
  },
  label: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  main: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
    ...fontStyle('body', '600'),
  },
  sub: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  count: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
  },
});
