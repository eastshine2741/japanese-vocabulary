import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, ColorMatrix, Image, useImage } from '@shopify/react-native-skia';
import { ArtistGrade } from './artistGrade';
import { ARTIST_PHOTO_TONE } from './artistPhotoTone';

interface Props {
  uri: string;
  grade: ArtistGrade;
  width: number;
  height: number;
}

/** 재질에 따라 색을 입힌 아티스트 사진. RN Image 엔 색 행렬이 없어 Skia 로 그린다. */
function ArtistPhoto({ uri, grade, width, height }: Props) {
  const image = useImage(uri);
  if (!image) return null;
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image image={image} x={0} y={0} width={width} height={height} fit="cover">
        <ColorMatrix matrix={ARTIST_PHOTO_TONE[grade] as number[]} />
      </Image>
    </Canvas>
  );
}

export default React.memo(ArtistPhoto);
