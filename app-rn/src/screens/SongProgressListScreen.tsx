import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useDeckListStore } from '../stores/deckListStore';
import { Colors, Dimens } from '../theme/theme';
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

  const renderItem = useCallback(
    ({ item }: { item: SongProgressItem }) => (
      <SongProgressRow item={item} onPress={handleRowPress} />
    ),
    [handleRowPress],
  );

  const keyExtractor = useCallback((item: SongProgressItem) => String(item.deckId), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.topNav}>
          <TouchableOpacity
            style={styles.navLeft}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
            <Text style={styles.navTitle}>곡별 진도</Text>
          </TouchableOpacity>
          <Text style={styles.navCount}>{items.length}곡</Text>
        </View>

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
  topNav: {
    height: 42,
    marginHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navLeft: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  navCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    paddingTop: 18,
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
