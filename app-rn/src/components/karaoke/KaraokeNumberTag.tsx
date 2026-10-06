import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme/theme';
import { fontStyle } from '../../theme/typography';

export type KaraokeBrand = 'TJ' | 'KY';

const BRANDS: Record<KaraokeBrand, { label: string; color: string; background: string }> = {
  TJ: { label: 'TJ', color: '#C42833', background: '#E2374414' },
  KY: { label: '금영', color: '#1A58D0', background: '#1A58D014' },
};

interface Props {
  brand: KaraokeBrand;
  number: number;
}

export const KaraokeNumberTag = React.memo(function KaraokeNumberTag({ brand, number }: Props) {
  const { label, color, background } = BRANDS[brand];
  return (
    <View style={styles.row}>
      <View style={[styles.chip, { backgroundColor: background }]}>
        <Text style={[styles.brand, { color }]}>{label}</Text>
      </View>
      <Text style={styles.number}>{number}</Text>
    </View>
  );
});

export const KARAOKE_NUMBERS_WIDTH = 84;

const styles = StyleSheet.create({
  row: {
    width: KARAOKE_NUMBERS_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    width: 30,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.2,
    ...fontStyle('body', '700'),
  },
  number: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.2,
    textAlign: 'right',
    color: Colors.textPrimary,
    ...fontStyle('body', '600'),
  },
});
