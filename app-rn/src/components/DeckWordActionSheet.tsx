import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../theme/theme';
import { ActionRow, SheetHeader } from './ui';
import { DeckWordItem } from '../types/deck';
import { joinMeanings } from '../types/word';

interface Props {
  item: DeckWordItem;
  onEdit: () => void;
  onDelete: () => void;
}

function DeckWordActionSheet({ item, onEdit, onDelete }: Props) {
  return (
    <View style={styles.container}>
      <SheetHeader title={item.japanese} subtitle={joinMeanings(item.senses)} />

      <View style={styles.divider} />

      <ActionRow icon="create-outline" label="수정" onPress={onEdit} />
      <ActionRow icon="trash-outline" label="삭제" onPress={onDelete} destructive />
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
});
