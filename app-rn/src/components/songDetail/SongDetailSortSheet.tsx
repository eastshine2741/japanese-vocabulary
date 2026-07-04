import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../theme/theme';
import { SongDetailWordsSort } from './types';

interface Props {
  value: SongDetailWordsSort;
  onApply: (value: SongDetailWordsSort) => void;
}

interface OptionProps {
  value: SongDetailWordsSort;
  label: string;
  selected: boolean;
  onSelect: (value: SongDetailWordsSort) => void;
}

const SortOption = React.memo(function SortOption({ value, label, selected, onSelect }: OptionProps) {
  const handlePress = useCallback(() => {
    onSelect(value);
  }, [onSelect, value]);

  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionSelected]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
});

export default function SongDetailSortSheet({ value, onApply }: Props) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const apply = useCallback(() => {
    onApply(draftValue);
  }, [draftValue, onApply]);

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <Text style={styles.title}>정렬</Text>
      <Text style={styles.sectionLabel}>정렬 기준</Text>
      <View style={styles.segmented}>
        <SortOption value="importance" label="중요도순" selected={draftValue === 'importance'} onSelect={setDraftValue} />
        <SortOption value="appearance" label="등장순" selected={draftValue === 'appearance'} onSelect={setDraftValue} />
      </View>
      <TouchableOpacity style={styles.applyButton} onPress={apply} activeOpacity={0.7}>
        <Text style={styles.applyText}>적용</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  segmented: {
    height: 44,
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: Colors.elevated,
  },
  optionSelected: {
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryBg,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
  optionTextSelected: {
    color: Colors.primary,
  },
  applyButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: Colors.primary,
  },
  applyText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
