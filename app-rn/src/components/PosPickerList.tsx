import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { POS_OPTIONS } from '../types/pos';
import { Colors } from '../theme/theme';

interface Props {
  selectedPos: string | null;
  onSelect: (pos: string) => void;
}

export default function PosPickerList({ selectedPos, onSelect }: Props) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>품사 선택</Text>
      </View>
      {POS_OPTIONS.map(({ key, label }) => {
        const isSelected = selectedPos === key;
        return (
          <TouchableOpacity
            key={key}
            style={styles.item}
            onPress={() => onSelect(key)}
            activeOpacity={0.6}
          >
            <Text style={[styles.itemText, isSelected && { color: Colors.primary, fontWeight: '600' }]}>
              {label}
            </Text>
            {isSelected && <Feather name="check" size={18} color={Colors.primary} />}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginHorizontal: 8,
    borderRadius: 12,
  },
  itemText: { fontSize: 15, color: Colors.textPrimary },
});
