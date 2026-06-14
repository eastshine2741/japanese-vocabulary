import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { useSearchHistoryStore } from '../stores/searchHistoryStore';
import { Colors } from '../theme/theme';

interface RowProps {
  term: string;
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
}

const HistoryRow = React.memo(function HistoryRow({ term, onSelect, onRemove }: RowProps) {
  const handleSelect = useCallback(() => onSelect(term), [onSelect, term]);
  const handleRemove = useCallback(() => onRemove(term), [onRemove, term]);

  return (
    <TouchableOpacity style={styles.row} onPress={handleSelect} activeOpacity={0.7}>
      <Ionicons name="time-outline" size={18} color={Colors.textMuted} />
      <Text style={styles.term} numberOfLines={1}>
        {term}
      </Text>
      <TouchableOpacity onPress={handleRemove} hitSlop={8}>
        <Ionicons name="close" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

interface Props {
  onSelectTerm: (term: string) => void;
}

export default function RecentSearchesSection({ onSelectTerm }: Props) {
  const { terms, load, remove } = useSearchHistoryStore(
    useShallow(s => ({ terms: s.terms, load: s.load, remove: s.remove })),
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (terms.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      {terms.map(term => (
        <HistoryRow key={term} term={term} onSelect={onSelectTerm} onRemove={remove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  term: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
});
