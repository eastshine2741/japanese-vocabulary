import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import ArtworkImage from './ArtworkImage';
import ErrorDialog from './ErrorDialog';
import { RootStackParamList } from '../navigation/AppNavigator';
import { usePlayerStore } from '../stores/playerStore';
import { useRecommendationStore } from '../stores/recommendationStore';
import { Colors, Dimens } from '../theme/theme';
import { RecommendedSongItem } from '../types/song';
import { getErrorMessage } from '../utils/errorMessages';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface RecommendedSongCardProps {
  item: RecommendedSongItem;
  onPress: (songId: number) => void;
}

const RecommendedSongCard = React.memo(function RecommendedSongCard({
  item,
  onPress,
}: RecommendedSongCardProps) {
  const handlePress = useCallback(() => {
    onPress(item.songId);
  }, [item.songId, onPress]);

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <ArtworkImage url={item.artworkUrl} size={116} />
      <Text style={styles.title} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {item.artist}
      </Text>
    </TouchableOpacity>
  );
});

export default function RecommendedSongsSection() {
  const navigation = useNavigation<Nav>();
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);

  const { songs, load } = useRecommendationStore(
    useShallow(s => ({ songs: s.songs, load: s.load })),
  );
  const loadById = usePlayerStore(s => s.loadById);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSongPress = useCallback(
    async (songId: number) => {
      await loadById(songId);
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
    ({ item }: ListRenderItemInfo<RecommendedSongItem>) => (
      <RecommendedSongCard item={item} onPress={handleSongPress} />
    ),
    [handleSongPress],
  );

  const keyExtractor = useCallback((item: RecommendedSongItem) => String(item.id), []);

  const dismissErrorDialog = useCallback(() => {
    setErrorDialogMessage(null);
  }, []);

  if (songs.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>추천곡</Text>
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
        onDismiss={dismissErrorDialog}
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
    paddingHorizontal: Dimens.screenPadding,
  },
  listContent: {
    paddingHorizontal: Dimens.screenPadding,
  },
  separator: {
    width: 12,
  },
  item: {
    width: 116,
    gap: 8,
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
