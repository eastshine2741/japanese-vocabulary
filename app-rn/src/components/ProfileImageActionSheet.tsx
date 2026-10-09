import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

interface Props {
  onPick: () => void;
  onRemove: () => void;
}

function ProfileImageActionSheet({ onPick, onRemove }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.actionRow} onPress={onPick} activeOpacity={0.6}>
        <Ionicons name="image-outline" size={20} color={Colors.textPrimary} />
        <Text style={styles.actionText}>앨범에서 선택</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionRow} onPress={onRemove} activeOpacity={0.6}>
        <Ionicons name="trash-outline" size={20} color={Colors.ratingAgain} />
        <Text style={[styles.actionText, styles.actionTextDanger]}>사진 삭제</Text>
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(ProfileImageActionSheet);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionTextDanger: {
    color: Colors.ratingAgain,
  },
});
