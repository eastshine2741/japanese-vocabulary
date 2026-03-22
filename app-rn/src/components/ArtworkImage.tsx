import React from 'react';
import { Image, View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Dimens } from '../theme/theme';

interface Props {
  url: string | null | undefined;
  size: number;
  cornerRadius?: number;
  style?: ViewStyle;
}

export default function ArtworkImage({ url, size, cornerRadius = Dimens.artworkCornerRadius, style }: Props) {
  return (
    <View style={[{ width: size, height: size, borderRadius: cornerRadius, overflow: 'hidden' }, style]}>
      {url ? (
        <Image source={{ uri: url }} style={styles.image} />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: Colors.cardBorder }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  placeholder: { width: '100%', height: '100%' },
});
