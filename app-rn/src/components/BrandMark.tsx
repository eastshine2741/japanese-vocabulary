import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

type Props = { size?: number };

export default function BrandMark({ size = 128 }: Props) {
  const radius = Math.round(size * 0.28);
  const iconSize = Math.round(size * 0.53);
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Ionicons name="leaf" size={iconSize} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 8,
  },
});
