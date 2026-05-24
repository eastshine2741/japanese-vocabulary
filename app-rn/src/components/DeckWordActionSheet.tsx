import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/theme';
import { DeckWordItem } from '../types/deck';

interface Props {
  item: DeckWordItem;
  onEdit: () => void;
  onDelete: () => void;
}

function DeckWordActionSheet({ item, onEdit, onDelete }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.wordJapanese} numberOfLines={1}>{item.japanese}</Text>
        <Text style={styles.wordMeaning} numberOfLines={1}>
          {item.meanings.map(m => m.text).join(', ')}
        </Text>
      </View>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.actionRow} onPress={onEdit} activeOpacity={0.6}>
        <Ionicons name="create-outline" size={20} color={Colors.textPrimary} />
        <Text style={styles.actionText}>수정</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionRow} onPress={onDelete} activeOpacity={0.6}>
        <Ionicons name="trash-outline" size={20} color={Colors.ratingAgain} />
        <Text style={[styles.actionText, styles.actionTextDanger]}>삭제</Text>
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(DeckWordActionSheet);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  header: {
    gap: 4,
    paddingVertical: 4,
  },
  wordJapanese: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  wordMeaning: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 8,
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
