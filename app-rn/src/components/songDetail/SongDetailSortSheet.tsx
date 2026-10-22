import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '../../theme/theme';
import { Button, Chip, SectionLabel, SheetHeader } from '../ui';
import { SongDetailWordsSort } from './types';

interface Props {
  value: SongDetailWordsSort;
  onApply: (value: SongDetailWordsSort) => void;
  onClose: () => void;
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

  return <Chip label={label} selected={selected} onPress={handlePress} style={styles.option} />;
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
        <SheetHeader title="정렬" onClose={onClose} closeAccessibilityLabel="정렬 닫기" />
        <View style={styles.section}>
          <SectionLabel>정렬 기준</SectionLabel>
          <View style={styles.segmented}>
            <SortOption value="appearance" label="등장순" selected={draftValue === 'appearance'} onSelect={setDraftValue} />
            <SortOption value="importance" label="중요도순" selected={draftValue === 'importance'} onSelect={setDraftValue} />
          </View>
        </View>
        <Button label="적용" onPress={apply} />
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
  section: {
    gap: 10,
  },
  segmented: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
  },
});
