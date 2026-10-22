import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../theme/theme';
import { ActionRow, SheetHeader } from './ui';

export interface SongDeckTarget {
  deckId: number;
  title: string;
  artist: string;
}

interface Props {
  target: SongDeckTarget;
  onDelete: () => void;
}

function SongDeckActionSheet({ target, onDelete }: Props) {
  return (
    <View style={styles.container}>
      <SheetHeader title={target.title} subtitle={target.artist} />

      <View style={styles.divider} />

      <ActionRow icon="remove-circle-outline" label="학습 그만두기" onPress={onDelete} destructive />
    </View>
  );
}

export default React.memo(SongDeckActionSheet);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
});
