import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StudySource } from './types';

/** 무대 안쪽 기본 위 여백. 크롬이 무대 위에 얹힐 때 그만큼 더 내려준다. */
const STAGE_PADDING_TOP = 14;
const STAGE_PADDING_BOTTOM = 22;

export interface CardStageProps {
  artworkUrl: string | null;
  /** 무대 위에 겹쳐 그리는 크롬 높이. 아트워크는 그대로 전체를 덮고 내용만 내려간다. */
  contentInsetTop?: number;
  /** 시스템 하단 영역 높이. 아트워크는 그대로 전체를 덮고 내용만 올린다. */
  contentInsetBottom?: number;
  children: React.ReactNode;
}

/** 곡 무대 — 아트워크 + 틴트 + 스크림 2겹. 같은 곡 안에서는 움직이지 않는다. */
export const CardStage = React.memo(function CardStage({
  artworkUrl,
  contentInsetTop,
  contentInsetBottom,
  children,
}: CardStageProps) {
  const insetStyle = {
    paddingTop: STAGE_PADDING_TOP + (contentInsetTop ?? 0),
    paddingBottom: STAGE_PADDING_BOTTOM + (contentInsetBottom ?? 0),
  };
  const content = (
    <>
      <View style={styles.tint} />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.68)', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.50)', 'rgba(0,0,0,0.07)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </>
  );

  if (!artworkUrl) {
    return <View style={[styles.stageArt, styles.fallbackArt, insetStyle]}>{content}</View>;
  }

  return (
    <ImageBackground
      source={{ uri: artworkUrl }}
      resizeMode="cover"
      blurRadius={8}
      style={[styles.stageArt, insetStyle]}
      imageStyle={styles.stageImage}
    >
      {content}
    </ImageBackground>
  );
});

export interface SourceHeaderProps {
  source: StudySource;
  onPress: () => void;
}

/** 곡 헤더 — 썸네일·곡명·아티스트·단어장 수치. 고정 요소라 wordLayer 와 함께 움직이지 않는다. */
export const SourceHeader = React.memo(function SourceHeader({ source, onPress }: SourceHeaderProps) {
  return (
    <Pressable style={styles.sourceRow} onPress={onPress} disabled={source.songId == null}>
      <ArtworkThumb artworkUrl={source.artworkUrl} size={40} radius={8} />
      <View style={styles.sourceTextCol}>
        <Text numberOfLines={1} style={styles.sourceTitle}>{source.title}</Text>
        <Text numberOfLines={1} style={styles.sourceSub}>{source.artist}</Text>
      </View>
      <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.6)" />
    </Pressable>
  );
});

export interface ArtworkThumbProps {
  artworkUrl: string | null;
  size: number;
  radius: number;
}

export const ArtworkThumb = React.memo(function ArtworkThumb({ artworkUrl, size, radius }: ArtworkThumbProps) {
  if (!artworkUrl) {
    return <View style={[styles.thumbFallback, { width: size, height: size, borderRadius: radius }]} />;
  }
  return (
    <ImageBackground
      source={{ uri: artworkUrl }}
      resizeMode="cover"
      style={[styles.thumb, { width: size, height: size, borderRadius: radius }]}
      imageStyle={{ borderRadius: radius }}
    />
  );
});

const styles = StyleSheet.create({
  stageArt: {
    flex: 1,
    backgroundColor: '#14181C',
    paddingHorizontal: 20,
    paddingTop: STAGE_PADDING_TOP,
    paddingBottom: STAGE_PADDING_BOTTOM,
  },
  fallbackArt: {
    backgroundColor: '#16242A',
  },
  stageImage: {
    transform: [{ scale: 1.18 }],
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,24,28,0.30)',
  },
  sourceRow: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 2,
  },
  thumb: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  thumbFallback: {
    backgroundColor: 'rgba(82,183,136,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  sourceTextCol: {
    flex: 1,
    gap: 2,
  },
  sourceTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sourceSub: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 11,
    fontWeight: '500',
  },
});
