import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSearchStore } from '../stores/searchStore';
import SongListItem from '../components/SongListItem';
import AppTopBar from '../components/AppTopBar';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const {
    searchStatus, items, isLoadingMore,
    analyzeStatus, studyData,
    search, loadMore, analyze,
  } = useSearchStore();

  useEffect(() => {
    if (analyzeStatus === 'success' && studyData) {
      navigation.navigate('Player', { origin: 'Home' });
    }
  }, [analyzeStatus, studyData]);

  const handleSearch = () => {
    if (query.trim()) search(query.trim());
  };

  return (
    <View style={styles.container}>
      <AppTopBar title="Search" onBack={() => navigation.goBack()} />
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search songs..."
          placeholderTextColor={Colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoFocus
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SongListItem
            artworkUrl={item.thumbnail}
            title={item.title}
            subtitle={item.artistName}
            onPress={() => analyze(item)}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          (searchStatus === 'loading' || isLoadingMore) ? (
            <ActivityIndicator style={styles.loader} color={Colors.primary} />
          ) : null
        }
        contentContainerStyle={styles.list}
      />

      {analyzeStatus === 'loading' && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: { paddingHorizontal: Dimens.screenPadding, paddingBottom: 8 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Dimens.smallCornerRadius,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  list: { paddingBottom: 20 },
  loader: { paddingVertical: 16 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
