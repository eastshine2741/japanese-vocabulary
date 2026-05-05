import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

interface Props {
  onOpenVocab: () => void;
}

function ActionChips({ onOpenVocab }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.chip} onPress={onOpenVocab} activeOpacity={0.7}>
        <Feather name="book-open" size={14} color={Colors.textPrimary} />
        <Text style={styles.chipText}>단어장</Text>
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(ActionChips);

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: Colors.card,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
