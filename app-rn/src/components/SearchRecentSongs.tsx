import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useHomeStore } from '../stores/homeStore';
import ArtworkImage from './ArtworkImage';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { RecentSongItem } from '../types/song';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const COVER_SIZE = 84;
const COVER_RADIUS = 10;

interface ItemProps {
  item: RecentSongItem;
  onPress: (id: number) => void;
}

const SearchRecentSongItem = React.memo(function SearchRecentSongItem({
  item,
  onPress,
}: ItemProps) {
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <TouchableOpacity style={styles.item} onPress={handlePress} activeOpacity={0.7}>
      <ArtworkImage url={item.artworkUrl} size={COVER_SIZE} cornerRadius={COVER_RADIUS} />
      <Text style={styles.title} numberOfLines={1}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
});

function Separator() {
  return <View style={styles.separator} />;
}

export default function SearchRecentSongs() {
  const navigation = useNavigation<Nav>();

  const { songs, load } = useHomeStore(
    useShallow(s => ({ songs: s.songs, load: s.load })),
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSongPress = useCallback(
    (id: number) => {
      navigation.navigate('SongDetail', { songId: id, origin: 'Home' });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<RecentSongItem>) => (
      <SearchRecentSongItem item={item} onPress={handleSongPress} />
    ),
    [handleSongPress],
  );

  const keyExtractor = useCallback((item: RecentSongItem) => String(item.id), []);

  if (songs.length === 0) {
    return null;
  }

  return (
    <View>
      <FlatList
        data={songs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
  },
  separator: {
    width: 12,
  },
  item: {
    width: COVER_SIZE,
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
    width: COVER_SIZE,
  },
});
