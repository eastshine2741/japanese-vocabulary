import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { useDeckListStore } from '../stores/deckListStore';
import ArtworkImage from '../components/ArtworkImage';
import { AppBar } from '../components/AppBar';
import { Colors, Dimens } from '../theme/theme';
import { SongDeckSummary } from '../types/deck';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckList'>;

interface DeckRowProps {
  deck: SongDeckSummary;
  onPress: (deckId: number) => void;
}

const DeckRow = React.memo(function DeckRow({ deck, onPress }: DeckRowProps) {
  const handlePress = useCallback(() => onPress(deck.deckId), [onPress, deck.deckId]);

  return (
    <TouchableOpacity style={styles.row} onPress={handlePress} activeOpacity={0.7}>
      <ArtworkImage url={deck.artworkUrl} size={44} cornerRadius={14} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {deck.title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {deck.artist} · {deck.wordCount}단어
        </Text>
      </View>
      {deck.dueCount > 0 && <Text style={styles.dueCount}>{deck.dueCount}</Text>}
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
});

export default function DeckListScreen({ navigation }: Props) {
  const { status, songDecks, isLoadingMore, load, loadMore } = useDeckListStore(
    useShallow(s => ({
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

  const handleRowPress = useCallback(
    (deckId: number) => {
      navigation.navigate('DeckDetail', { deckId });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: SongDeckSummary }) => (
      <DeckRow deck={item} onPress={handleRowPress} />
    ),
    [handleRowPress],
  );

  const keyExtractor = useCallback((item: SongDeckSummary) => String(item.deckId), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <AppBar title="단어장" onBack={() => navigation.goBack()} />
        <View style={styles.headerSeparator} />

        {status === 'loading' ? (
          <ActivityIndicator size="large" color={Colors.primary} style={styles.center} />
        ) : (
          <FlatList
            data={songDecks}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            onEndReached={() => loadMore()}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoadingMore ? <ActivityIndicator color={Colors.primary} style={{ padding: 16 }} /> : null
            }
            contentContainerStyle={styles.list}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={7}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: Colors.border,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: Dimens.screenPadding,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textSecondary,
  },
  dueCount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
});
