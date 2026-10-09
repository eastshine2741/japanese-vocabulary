import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/theme';

interface Props {
  url: string | null;
  size: number;
}

function ProfileAvatar({ url, size }: Props) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {url ? (
        <Image source={{ uri: url }} style={styles.image} />
      ) : (
        <Ionicons name="person" size={size / 2} color={Colors.textMuted} />
      )}
    </View>
  );
}

export default React.memo(ProfileAvatar);

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
