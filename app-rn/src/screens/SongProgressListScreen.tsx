import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useDeckListStore } from '../stores/deckListStore';
import { useHomeChromeStore } from '../stores/homeChromeStore';
import { useDeleteSongDeck, useSongDeckActionSheet } from '../hooks/useDeleteSongDeck';
import type { SongDeckTarget } from '../components/SongDeckActionSheet';
import { Colors, Dimens } from '../theme/theme';
import { AppBar } from '../components/AppBar';
import SongProgressRow from '../components/studyStats/SongProgressRow';
import { SongProgressItem, toSongProgressItem } from '../components/studyStats/songProgress';

type Props = NativeStackScreenProps<RootStackParamList, 'SongProgressList'>;

export default function SongProgressListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { status, songDecks, isLoadingMore, load, loadMore } = useDeckListStore(
    useShallow((s) => ({
      status: s.status,
      songDecks: s.songDecks,
      isLoadingMore: s.isLoadingMore,
      load: s.load,
      loadMore: s.loadMore,
    })),
  );
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const items = useMemo(() => songDecks.map(toSongProgressItem), [songDecks]);

  const handleRowPress = useCallback((item: SongProgressItem) => {
    if (item.songId != null) {
      navigation.navigate('SongDetail', { songId: item.songId, origin: 'profile_song_progress_list' });
    } else {
      navigation.navigate('DeckDetail', { deckId: item.deckId });
    }
  }, [navigation]);

  const requestHomeReload = useHomeChromeStore((s) => s.requestReload);
  const handleDeckDeleted = useCallback(() => {
    load();
    requestHomeReload();
  }, [load, requestHomeReload]);
  const deckDeletion = useDeleteSongDeck(handleDeckDeleted);
  const { requestDelete } = deckDeletion;
  const handleDeleteFromSheet = useCallback((target: SongDeckTarget) => {
    requestDelete(target.deckId);
  }, [requestDelete]);
  const deckActions = useSongDeckActionSheet(handleDeleteFromSheet);
  const { open: openDeckActions } = deckActions;
  const handleRowLongPress = useCallback((item: SongProgressItem) => {
    openDeckActions({ deckId: item.deckId, title: item.title, artist: item.artist });
  }, [openDeckActions]);

  // 일반 단어장(songId == null)은 곡 담기 취소 대상이 아니라 롱프레스를 걸지 않는다.
  const renderItem = useCallback(
    ({ item }: { item: SongProgressItem }) => (
      <SongProgressRow
        item={item}
        onPress={handleRowPress}
        onLongPress={item.songId != null ? handleRowLongPress : undefined}
      />
    ),
    [handleRowPress, handleRowLongPress],
  );

  const keyExtractor = useCallback((item: SongProgressItem) => String(item.deckId), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <AppBar
          title="곡별 진도"
          onBack={() => navigation.goBack()}
          trailing={<Text style={styles.navCount}>{items.length}곡</Text>}
        />

        {status === 'loading' && items.length === 0 ? (
          <ActivityIndicator color={Colors.primary} style={styles.center} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={<EmptyState />}
            ListFooterComponent={
              isLoadingMore ? <ActivityIndicator color={Colors.primary} style={styles.footerLoading} /> : null
            }
            contentContainerStyle={[styles.list, { paddingBottom: Dimens.bottomBarHeight + insets.bottom + 24 }]}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={7}
          />
        )}
      </View>
      {deckActions.sheet}
      {deckDeletion.dialogs}
    </SafeAreaView>
  );
}

const EmptyState = React.memo(function EmptyState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>곡별 진도가 아직 없어요</Text>
      <Text style={styles.emptyText}>노래에서 단어를 저장하면 곡별 진행률이 쌓여요</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  navCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
    paddingRight: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 24,
  },
  footerLoading: {
    padding: 16,
  },
  empty: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
