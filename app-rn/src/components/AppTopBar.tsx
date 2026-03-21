import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Dimens } from '../theme/theme';

interface Props {
  title: string;
  onBack?: () => void;
  onClose?: () => void;
  rightAction?: React.ReactNode;
}

export default function AppTopBar({ title, onBack, onClose, rightAction }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
        {onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Dimens.screenPadding,
    backgroundColor: Colors.background,
  },
  left: { width: 40 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  right: { width: 40, alignItems: 'flex-end' },
});
