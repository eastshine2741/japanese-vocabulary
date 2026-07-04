import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SongDetailJlptChart } from './SongDetailJlptChart';
import { SongDetailMajorWords } from './SongDetailMajorWords';
import { SongDetailWordItem } from './types';

interface SongDetailHomeTabProps {
  words: readonly SongDetailWordItem[];
  isLoadingWords?: boolean;
  onViewAllWordsPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const SongDetailHomeTab = React.memo(function SongDetailHomeTab({
  words,
  isLoadingWords = false,
  onViewAllWordsPress,
  style,
}: SongDetailHomeTabProps) {
  return (
    <View style={[styles.container, style]}>
      <SongDetailMajorWords
        words={words}
        isLoading={isLoadingWords}
        onViewAllWordsPress={onViewAllWordsPress}
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
