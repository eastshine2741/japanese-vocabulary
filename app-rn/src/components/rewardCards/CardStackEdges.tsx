import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  width: number;
  borderRadius: number;
}

// 같은 곡(아티스트)의 다른 등급 카드가 뒤에 있다는 것만 알린다. 칸 높이를 바꾸지 않게 위로 삐져나온다.
function CardStackEdges({ width, borderRadius }: Props) {
  const step = Math.max(3, Math.round(width * 0.03));
  return (
    <>
      <View style={[styles.edge, styles.far, { top: -step * 2, left: step * 2, right: step * 2, borderRadius }]} />
      <View style={[styles.edge, styles.near, { top: -step, left: step, right: step, borderRadius }]} />
    </>
  );
}

export default React.memo(CardStackEdges);

const styles = StyleSheet.create({
  edge: { position: 'absolute', bottom: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(20, 12, 30, 0.18)' },
  far: { backgroundColor: '#D8D4DE' },
  near: { backgroundColor: '#E7E4EC' },
});
