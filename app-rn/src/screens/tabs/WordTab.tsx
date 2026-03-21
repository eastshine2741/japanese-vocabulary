import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDeckListStore } from '../../stores/deckListStore';
import StatsCard from '../../components/StatsCard';
import SongListItem from '../../components/SongListItem';
import { SongDeckSummary } from '../../types/deck';
import { Colors, Dimens } from '../../theme/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WordTab() {
  const navigation = useNavigation<Nav>();
  const { status, data, load } = useDeckListStore();

  useEffect(() => {
    load();
  }, []);

  const renderHeader = () => {
    if (!data) return null;
    return (
      <View style={styles.header}>
        <StatsCard
          wordCount={data.allDeck.wordCount}
          dueToday={0}
          actionLabel="View All"
          onAction={() => navigation.navigate('DeckDetail', { songId: null })}
        />
      </View>
    );
  };

  const renderDeck = ({ item }: { item: SongDeckSummary }) => (
    <SongListItem
      artworkUrl={item.artworkUrl}
      title={item.title}
      subtitle={`${item.artist} · ${item.wordCount} words`}
      trailing={
        item.avgRetrievability != null
          ? `${Math.round(item.avgRetrievability * 100)}%`
          : undefined
      }
      onPress={() => navigation.navigate('DeckDetail', { songId: item.songId })}
    />
  );

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data?.songDecks ?? []}
        keyExtractor={(item) => String(item.songId)}
        ListHeaderComponent={renderHeader}
        renderItem={renderDeck}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: Dimens.screenPadding },
  header: { marginBottom: 16 },
});
