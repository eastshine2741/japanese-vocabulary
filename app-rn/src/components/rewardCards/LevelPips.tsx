import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CardLevel } from './types';

interface Props {
  level: CardLevel;
  color: string;
  size: number;
}

function LevelPips({ level, color, size }: Props) {
  const pipStyle = { width: size, height: size, borderWidth: Math.max(1, size * 0.16) };
  return (
    <View style={[styles.row, { gap: size * 0.75 }]}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.pip,
            pipStyle,
            i <= level ? { backgroundColor: color, borderColor: color } : { borderColor: `${color}88` },
          ]}
        />
      ))}
    </View>
  );
}

export default React.memo(LevelPips);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  pip: { transform: [{ rotate: '45deg' }] },
});
