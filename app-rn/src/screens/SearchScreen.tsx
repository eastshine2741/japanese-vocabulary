import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSearchStore } from '../stores/searchStore';
import SongListItem from '../components/SongListItem';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const {
    searchStatus, items, isLoadingMore,
    analyzeStatus, studyData,
    search, loadMore, analyze, resetAnalyze,
  } = useSearchStore();

  useEffect(() => {
    resetAnalyze();
  }, []);

  useEffect(() => {
    if (analyzeStatus === 'success' && studyData) {
      navigation.navigate('Player', { origin: 'Home' });
    }
  }, [analyzeStatus, studyData]);

  const handleSearch = () => {
    if (query.trim()) search(query.trim());
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

      {/* Search row */}
      <View style={styles.searchRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="노래 검색..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setQuery('')}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Result header */}
      {items.length > 0 && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultLabel}>검색 결과</Text>
          <Text style={styles.resultCount}>{items.length}곡</Text>
        </View>
      )}

      {/* Result list */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SongListItem
            artworkUrl={item.thumbnail}
            title={item.title}
            subtitle={`${item.artistName} · ${formatDuration(item.durationSeconds)}`}
            showChevron
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
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Loading overlay for analyze */}
      {analyzeStatus === 'loading' && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Dimens.screenPadding,
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Dimens.smallCornerRadius,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  clearButton: {
    marginLeft: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Dimens.screenPadding,
    paddingTop: 8,
    paddingBottom: 4,
  },
  resultLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  resultCount: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  list: {
    paddingHorizontal: Dimens.screenPadding,
    paddingBottom: 20,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 48 + 12, // artwork size + gap
  },
  loader: {
    paddingVertical: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
