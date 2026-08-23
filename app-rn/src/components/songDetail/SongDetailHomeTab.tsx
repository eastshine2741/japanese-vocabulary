import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SongDetailJlptChart } from './SongDetailJlptChart';
import { SongDetailMajorWords } from './SongDetailMajorWords';
import { SongDetailWordItem, SongDetailWordSaveState } from './types';

interface SongDetailHomeTabProps {
  words: readonly SongDetailWordItem[];
  isLoadingWords?: boolean;
  onViewAllWordsPress?: () => void;
  getWordSaveState: (word: SongDetailWordItem) => SongDetailWordSaveState;
  busyWordKey: string | null;
  onToggleWordSave: (word: SongDetailWordItem) => void;
  style?: StyleProp<ViewStyle>;
}

export const SongDetailHomeTab = React.memo(function SongDetailHomeTab({
  words,
  isLoadingWords = false,
  onViewAllWordsPress,
  getWordSaveState,
  busyWordKey,
  onToggleWordSave,
  style,
}: SongDetailHomeTabProps) {
  return (
    <View style={[styles.container, style]}>
      <SongDetailMajorWords
        words={words}
        isLoading={isLoadingWords}
        onViewAllWordsPress={onViewAllWordsPress}
        getWordSaveState={getWordSaveState}
        busyWordKey={busyWordKey}
        onToggleWordSave={onToggleWordSave}
      />
      <SongDetailJlptChart words={words} isLoading={isLoadingWords} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 28,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
});
