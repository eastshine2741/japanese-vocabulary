import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import ArtworkImage from '../components/ArtworkImage';
import ErrorDialog from '../components/ErrorDialog';
import RowSpinner from '../components/RowSpinner';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../stores/playerStore';
import { isAnalyzingSong, useAnalysisStore } from '../stores/analysisStore';
import { useSearchHistoryStore } from '../stores/searchHistoryStore';
import { songApi } from '../api/songApi';
import { trackSearchSubmit } from '../services/analytics';
import { Colors } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getErrorMessage } from '../utils/errorMessages';
import { SongSearchItem } from '../types/song';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'SongSearch'>;

type Status = 'loading' | 'success' | 'error';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SearchResultRowProps {
  item: SongSearchItem;
  onPress: (item: SongSearchItem) => void;
  // Existence check in flight screen-wide: every row is untappable, or a second tap
  // can race the first callback and navigate to the wrong song. Running analyses don't block rows.
  disabled: boolean;
  // This row is the one being checked. Derived from store status so a stale checkingItemId can't leave it spinning.
  isActiveRow: boolean;
}

const SearchResultRow = React.memo(function SearchResultRow({
  item, onPress, disabled, isActiveRow,
}: SearchResultRowProps) {
  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);
  // Keeps spinning after the existence check ends while analysis runs, mirroring the pill.
  const isAnalyzing = useAnalysisStore(s => isAnalyzingSong(s.jobs, item.title, item.artistName));

  return (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={handlePress}
      activeOpacity={0.72}
      disabled={disabled}
    >
      <ArtworkImage url={item.thumbnail} size={48} cornerRadius={8} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.resultSubtitle} numberOfLines={1}>
          {item.artistName} · {formatDuration(item.durationSeconds)}
        </Text>
      </View>
      {isActiveRow || isAnalyzing ? (
        <RowSpinner />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      )}
    </TouchableOpacity>
  );
});

function ResultSeparator() {
  return <View style={styles.resultGap} />;
}

export default function SongSearchResultsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const initialQuery = route.params.query;
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<SongSearchItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [checkingItemId, setCheckingItemId] = useState<string | null>(null);

  const analyze = usePlayerStore(s => s.analyze);
  const playerStatus = usePlayerStore(s => s.status);
  const resetPlayer = usePlayerStore(s => s.reset);
  const recordSearchLocally = useSearchHistoryStore(s => s.recordLocally);

  // Only the lookup and the analysis request ('loading') block rows; after that the global pill takes over.
  const isChecking = playerStatus === 'loading';

  // Each executed search lives on its own stack entry, so it runs once per mount.
  useEffect(() => {
    recordSearchLocally(initialQuery);
    let cancelled = false;
    setStatus('loading');
    songApi
      .search(initialQuery)
      .then(res => {
        if (cancelled) return;
        trackSearchSubmit(initialQuery, res.items.length);
        setItems(res.items);
        setStatus('success');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [initialQuery, recordSearchLocally]);

  useEffect(() => {
    return () => {
      const currentStatus = usePlayerStore.getState().status;
      if (currentStatus === 'loading') {
        resetPlayer();
      }
    };
  }, [resetPlayer]);

  const handleAnalyze = useCallback((item: SongSearchItem) => {
    // Guards a tap queued before `disabled` propagates.
    if (isChecking) return;
    Keyboard.dismiss();
    setCheckingItemId(item.id);
    analyze(item).then(() => {
      const state = usePlayerStore.getState();
      if (state.status === 'success') {
        if (!navigation.isFocused()) return;
        navigation.navigate('SongDetail', { songId: state.studyData?.song.id, origin: 'Home' });
      } else if (state.status === 'error') {
        setErrorDialogMessage(
          state.errorCode === 'LYRICS_NOT_FOUND'
            ? `${item.title}의 가사를 찾을 수 없었어요.`
            : getErrorMessage(state.errorCode),
        );
      }
    });
  }, [analyze, navigation, isChecking]);

  // Refining pushes a new stack entry so back steps through past queries.
  const runSearch = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      Keyboard.dismiss();
      navigation.push('SongSearch', { query: trimmed });
    },
    [navigation],
  );

  const renderResultItem = useCallback(
    ({ item }: { item: SongSearchItem }) => (
      <SearchResultRow
        item={item}
        onPress={handleAnalyze}
        disabled={isChecking}
        isActiveRow={isChecking && item.id === checkingItemId}
      />
    ),
    [handleAnalyze, checkingItemId, isChecking],
  );

  const keyExtractor = useCallback((item: SongSearchItem) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.searchRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="노래, 아티스트 검색"
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {status === 'success' && items.length > 0 && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultLabel}>검색 결과</Text>
          <Text style={styles.resultCount}>{items.length}곡</Text>
        </View>
      )}

      {status === 'loading' ? (
        <View style={styles.messageBox}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.messageText}>검색 중...</Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.messageBox}>
          <Feather name="alert-circle" size={28} color={Colors.textMuted} />
          <Text style={styles.messageText}>검색에 실패했어요. 다시 시도해주세요.</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.messageBox}>
          <View style={styles.emptyIconWrap}>
            <Feather name="search" size={28} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle} numberOfLines={2}>
            '{initialQuery}'에 대한 검색 결과가 없어요
          </Text>
          <Text style={styles.emptySubtitle}>다른 검색어로 다시 시도해보세요</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderResultItem}
          ListFooterComponent={
            <Text style={styles.attribution}>Music search powered by Apple Music</Text>
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={ResultSeparator}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <ErrorDialog message={errorDialogMessage} onDismiss={() => setErrorDialogMessage(null)} />
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
    paddingHorizontal: 20,
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 0,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  resultCount: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  resultGap: {
    height: 4,
  },
  resultRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  resultSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  messageBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 6,
  },
  messageText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    alignSelf: 'stretch',
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  attribution: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
