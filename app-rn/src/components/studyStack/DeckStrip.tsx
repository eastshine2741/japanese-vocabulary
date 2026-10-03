import React, { useCallback } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../theme/theme';
import { Typography } from '../../theme/typography';
import { StudySource } from './types';

const RING_SIZE = 72;
const TILE_SIZE = 64;
const ITEM_WIDTH = 72;

export const DECK_STRIP_HEIGHT = 8 + RING_SIZE + 6 + 16 + 10;

export interface DeckStripProps {
  items: StudySource[];
  selectedSongId: number | null;
  onSelect: (source: StudySource) => void;
  onSearch: () => void;
}

/** 홈 헤더의 곡 선택 스트립. '좋아하는 곡'은 선택 대상이 아니라 검색 탭으로 보내는 버튼이다. */
export const DeckStrip = React.memo(function DeckStrip({
  items,
  selectedSongId,
  onSelect,
  onSearch,
}: DeckStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <SearchEntry onPress={onSearch} />
      {items.map(item => (
        <DeckStripTile
          key={item.songId ?? item.deckId}
          item={item}
          selected={item.songId != null && item.songId === selectedSongId}
          onSelect={onSelect}
        />
      ))}
    </ScrollView>
  );
});

const SearchEntry = React.memo(function SearchEntry({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.item} hitSlop={4}>
      <View style={styles.ring}>
        <LinearGradient
          colors={['#3FD08A', '#16B364']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.searchTile}
        >
          <Feather name="search" size={24} color="#FFFFFF" />
        </LinearGradient>
      </View>
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.labelSelected}>좋아하는 곡</Text>
    </Pressable>
  );
});

interface DeckStripTileProps {
  item: StudySource;
  selected: boolean;
  onSelect: (source: StudySource) => void;
}

const DeckStripTile = React.memo(function DeckStripTile({ item, selected, onSelect }: DeckStripTileProps) {
  const handlePress = useCallback(() => onSelect(item), [item, onSelect]);
  return (
    <Pressable onPress={handlePress} style={styles.item} hitSlop={4}>
      <View style={[styles.ring, selected && styles.ringSelected]}>
        {item.artworkUrl ? (
          <Image
            source={{ uri: item.artworkUrl }}
            style={[styles.tile, !selected && styles.tileDim]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.tile, styles.tilePlaceholder, !selected && styles.tileDim]} />
        )}
      </View>
      <Text numberOfLines={1} ellipsizeMode="tail" style={selected ? styles.labelSelected : styles.labelUnselected}>
        {item.title}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  item: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    gap: 6,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSelected: {
    borderColor: Colors.primary,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tileDim: {
    opacity: 0.72,
  },
  tilePlaceholder: {
    backgroundColor: Colors.elevated,
  },
  searchTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelSelected: {
    ...Typography.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  labelUnselected: {
    ...Typography.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    color: Colors.textMuted,
  },
});
