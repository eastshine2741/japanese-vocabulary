import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/theme';
import { SongDetailWordsSort } from './types';

interface Props {
  value: SongDetailWordsSort;
  onApply: (value: SongDetailWordsSort) => void;
  onClose?: () => void;
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

export default function SongDetailSortSheet({ value, onApply, onClose }: Props) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const apply = useCallback(() => {
    onApply(draftValue);
  }, [draftValue, onApply]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>정렬</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            disabled={onClose == null}
            accessibilityRole="button"
            accessibilityLabel="정렬 닫기"
          >
            <Feather name="x" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>정렬 기준</Text>
          <View style={styles.segmented}>
            <SortOption value="importance" label="중요도순" selected={draftValue === 'importance'} onSelect={setDraftValue} />
            <SortOption value="appearance" label="등장순" selected={draftValue === 'appearance'} onSelect={setDraftValue} />
          </View>
        </View>
        <TouchableOpacity style={styles.applyButton} onPress={apply} activeOpacity={0.7}>
          <Text style={styles.applyText}>적용</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: Colors.background,
  },
  content: {
    gap: 20,
    paddingTop: 4,
    paddingRight: 20,
    paddingBottom: 28,
    paddingLeft: 20,
    backgroundColor: Colors.background,
  },
  header: {
    width: '100%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: '#F6F6F6',
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  segmented: {
    height: 40,
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
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  optionTextSelected: {
    fontWeight: '800',
    color: Colors.primary,
  },
  applyButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    backgroundColor: Colors.primary,
  },
  applyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
