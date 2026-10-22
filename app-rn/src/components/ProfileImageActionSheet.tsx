import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActionRow } from './ui';

interface Props {
  onPick: () => void;
  onRemove: () => void;
}

function ProfileImageActionSheet({ onPick, onRemove }: Props) {
  return (
    <View style={styles.container}>
      <ActionRow icon="image-outline" label="앨범에서 선택" onPress={onPick} />
      <ActionRow icon="trash-outline" label="사진 삭제" onPress={onRemove} destructive />
    </View>
  );
}

export default React.memo(ProfileImageActionSheet);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
});
