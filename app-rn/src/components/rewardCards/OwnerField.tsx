import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CardFonts } from './cardTheme';

interface Props {
  name: string;
  /** 카드 폭의 1/100. */
  u: number;
  fonts: CardFonts;
}

/** 멤버십 카드 뒷면의 이름 칸. 인쇄된 줄 위에 주인 이름을 찍는다. */
function OwnerField({ name, u, fonts }: Props) {
  return (
    <View style={{ gap: 0.8 * u }}>
      <Text style={[styles.label, { fontFamily: fonts.ko, fontSize: 2.4 * u, letterSpacing: 0.4 * u }]}>소유자</Text>
      <Text
        style={[styles.name, { fontFamily: fonts.koBold, fontSize: 4.6 * u, lineHeight: 5.8 * u, letterSpacing: 0.3 * u }]}
        numberOfLines={1}
      >
        {name}
      </Text>
      <View style={styles.rule} />
    </View>
  );
}

export default React.memo(OwnerField);

const styles = StyleSheet.create({
  label: { color: '#FFFFFF8C' },
  name: { color: '#F2EEF7' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: '#FFFFFF4D' },
});
