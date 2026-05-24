import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

interface Props {
  title?: string;
  onBack?: () => void;
  trailing?: React.ReactNode;
}

export function AppBar({ title, onBack, trailing }: Props) {
  return (
    <View style={styles.container}>
      {onBack && (
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
      )}
      {title ? (
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      ) : null}
      <View style={styles.spacer} />
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  spacer: {
    flex: 1,
  },
});
