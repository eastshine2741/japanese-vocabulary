import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useHomeStore } from '../stores/homeStore';
import { usePlayerStore } from '../stores/playerStore';
import ErrorDialog from './ErrorDialog';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getErrorMessage } from '../utils/errorMessages';
import { RecentSongItem } from '../types/song';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface SongCarouselItemProps {
  item: RecentSongItem;
  onPress: (id: number) => void;
}

const SongCarouselItem = React.memo(function SongCarouselItem({
  item,
  onPress,
}: SongCarouselItemProps) {
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {item.artworkUrl ? (
        <Image
          source={{ uri: item.artworkUrl }}
          style={styles.cover}
        />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]} />
      )}
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {item.artist}
      </Text>
    </TouchableOpacity>
  );
});

export default function RecentSongsSection() {
  const navigation = useNavigation<Nav>();
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);

  const { songs, load } = useHomeStore(
    useShallow(s => ({ songs: s.songs, load: s.load })),
  );
  const loadById = usePlayerStore(s => s.loadById);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSongPress = useCallback(
    async (id: number) => {
      await loadById(id);
      const state = usePlayerStore.getState();
      if (state.status === 'success') {
        navigation.navigate('Player', { origin: 'Home' });
      } else if (state.status === 'error') {
        setErrorDialogMessage(getErrorMessage(state.errorCode));
      }
    },
    [loadById, navigation],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<RecentSongItem>) => (
      <SongCarouselItem item={item} onPress={handleSongPress} />
    ),
    [handleSongPress],
  );

  const keyExtractor = useCallback((item: RecentSongItem) => String(item.id), []);

  if (songs.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>최근 들은 노래</Text>
      <FlatList
        data={songs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.listContent}
      />
      <ErrorDialog
        message={errorDialogMessage}
        onDismiss={() => setErrorDialogMessage(null)}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  listContent: {
    // no extra padding needed; parent screen handles horizontal padding
  },
  separator: {
    width: 12,
  },
  item: {
    width: 116,
    gap: 8,
  },
  cover: {
    width: 116,
    height: 116,
    borderRadius: 12,
  },
  coverPlaceholder: {
    backgroundColor: Colors.card,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
    width: 116,
  },
  artist: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.textMuted,
    width: 116,
  },
});
