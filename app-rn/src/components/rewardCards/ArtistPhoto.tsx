import React from 'react';
import { Image, ImageStyle, StyleSheet } from 'react-native';
import { ArtistGrade } from './artistGrade';
import { ARTIST_PHOTO_CSS } from './artistPhotoTone';

interface Props {
  uri: string;
  grade: ArtistGrade;
  width: number;
  height: number;
}

// 웹(개발용)은 CSS 필터로 흉내만 낸다. 앱은 ArtistPhoto.native.tsx.
function ArtistPhoto({ uri, grade }: Props) {
  return (
    <Image
      source={{ uri }}
      style={[StyleSheet.absoluteFill, { filter: ARTIST_PHOTO_CSS[grade] } as unknown as ImageStyle]}
      resizeMode="cover"
    />
  );
}

export default React.memo(ArtistPhoto);
