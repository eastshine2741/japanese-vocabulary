import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import ArtworkImage from '../components/ArtworkImage';
import AnalyzingView from '../components/AnalyzingView';
import ErrorDialog from '../components/ErrorDialog';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../stores/playerStore';
import { useSearchHistoryStore } from '../stores/searchHistoryStore';
import { songApi } from '../api/songApi';
import { Colors, Dimens } from '../theme/theme';
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
  // Whether ANY row-triggered work (existence check or a brand-new analysis)
  // is in flight screen-wide. Every row must be untappable while this is
  // true, or a second tap can race the first request's callback and
  // navigate to the wrong song (see handleAnalyze).
  disabled: boolean;
  // Whether THIS row is the one being checked/analyzed, so only it shows
  // the spinner in place of the chevron.
  isActiveRow: boolean;
  spinRotate: Animated.AnimatedInterpolation<string | number>;
}

const SearchResultRow = React.memo(React.forwardRef<View, SearchResultRowProps>(
  function SearchResultRow({ item, onPress, disabled, isActiveRow, spinRotate }, ref) {
    const handlePress = useCallback(() => {
      onPress(item);
    }, [item, onPress]);

    return (
      <View ref={ref} collapsable={false}>
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
          {isActiveRow ? (
            <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
              <Feather name="loader" size={18} color={Colors.primary} />
            </Animated.View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>
    );
  },
));

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
  const [analyzingItem, setAnalyzingItem] = useState<SongSearchItem | null>(null);
  const [rowMorphReady, setRowMorphReady] = useState(false);
  const [checkingItemId, setCheckingItemId] = useState<string | null>(null);

  const analyze = usePlayerStore(s => s.analyze);
  const playerStatus = usePlayerStore(s => s.status);
  const resetPlayer = usePlayerStore(s => s.reset);
  const recordSearchLocally = useSearchHistoryStore(s => s.recordLocally);

  // Existence check ('loading') keeps the list on screen with just a row
  // spinner; only an actual new analysis ('analyzing') earns the full-screen
  // "가사를 분석하는 중..." graphic.
  const isChecking = playerStatus === 'loading';
  const isAnalyzingNewSong = playerStatus === 'analyzing';

  const rowAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const rowRefs = useRef<Map<string, View>>(new Map()).current;
  const fromYRef = useRef<number>(0);
  const animatedRowRef = useRef<View>(null);
  const pendingItemRef = useRef<SongSearchItem | null>(null);

  // Run the search for this screen's query once on mount. Each executed search
  // lives on its own stack entry, so a fresh screen == a fresh search.
  useEffect(() => {
    recordSearchLocally(initialQuery);
    let cancelled = false;
    setStatus('loading');
    songApi
      .search(initialQuery)
      .then(res => {
        if (cancelled) return;
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
    if (!isChecking && !isAnalyzingNewSong) return;
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => {
      spin.stop();
      spinAnim.setValue(0);
    };
  }, [isChecking, isAnalyzingNewSong, spinAnim]);

  // Only the real "new analysis" phase (step 3) morphs the row into the
  // full-screen graphic. The cheap existence check (step 2) never sets
  // analyzingItem, so the list stays on screen for it.
  useEffect(() => {
    if (isAnalyzingNewSong && pendingItemRef.current) {
      setAnalyzingItem(pendingItemRef.current);
      setRowMorphReady(false);
    } else if (!isAnalyzingNewSong) {
      setAnalyzingItem(null);
      setRowMorphReady(false);
    }
  }, [isAnalyzingNewSong]);

  // Once the existence check (or the analysis it may lead to) finishes, drop
  // the row-level "checking" indicator.
  useEffect(() => {
    if (!isChecking && !isAnalyzingNewSong) {
      setCheckingItemId(null);
      pendingItemRef.current = null;
    }
  }, [isChecking, isAnalyzingNewSong]);

  useEffect(() => {
    return () => {
      const currentStatus = usePlayerStore.getState().status;
      if (currentStatus === 'loading' || currentStatus === 'analyzing') {
        resetPlayer();
      }
    };
  }, [resetPlayer]);

  const handleAnalyzingRowLayout = useCallback(() => {
    if (rowMorphReady) return;
    animatedRowRef.current?.measureInWindow((_x, y) => {
      const fromY = fromYRef.current;
      if (fromY > 0 && y > 0) {
        rowAnim.setValue(fromY - y);
      } else {
        rowAnim.setValue(0);
      }
      setRowMorphReady(true);
      Animated.timing(rowAnim, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [rowMorphReady, rowAnim]);

  const handleAnalyze = useCallback((item: SongSearchItem) => {
    // Row taps are disabled screen-wide while a check/analysis is in
    // flight, but guard re-entry here too in case a tap is already queued
    // before disabled propagates.
    if (isChecking || isAnalyzingNewSong) return;
    Keyboard.dismiss();
    const start = (fromY: number) => {
      // Captured now, while the row is still on screen, so the later morph
      // into the full-screen graphic (if a new analysis turns out to be
      // needed) animates from the right spot.
      fromYRef.current = fromY;
      pendingItemRef.current = item;
      setCheckingItemId(item.id);
      analyze(item).then(() => {
        const state = usePlayerStore.getState();
        if (state.status === 'success') {
          navigation.navigate('SongDetail', { songId: state.studyData?.song.id, origin: 'Home' });
        } else if (state.status === 'error') {
          setErrorDialogMessage(getErrorMessage(state.errorCode));
        }
      });
    };
    const el = rowRefs.get(item.id);
    if (el) {
      el.measureInWindow((_x, y) => start(y));
    } else {
      start(0);
    }
  }, [analyze, navigation, rowRefs, isChecking, isAnalyzingNewSong]);

  // Refining the search pushes a new stack entry so each query keeps its own
  // results and the back button steps through them.
  const runSearch = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      Keyboard.dismiss();
      navigation.push('SongSearch', { query: trimmed });
    },
    [navigation],
  );

  // Stabilized so it doesn't change identity every render (e.g. on every
  // `setQuery` keystroke) — otherwise `renderResultItem` below would change
  // identity too, defeating `SearchResultRow`'s React.memo for every row.
  const spinRotate = useMemo(
    () =>
      spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    [spinAnim],
  );

  // Screen-wide busy flag: any row-triggered work in flight (existence
  // check or a brand-new analysis) must disable every row, not just the
  // one being checked — otherwise a second tap can race the first
  // request's callback and navigate to the wrong song.
  const isRowInteractionDisabled = isChecking || isAnalyzingNewSong;

  const renderResultItem = useCallback(
    ({ item }: { item: SongSearchItem }) => (
      <SearchResultRow
        ref={(el) => {
          if (el) rowRefs.set(item.id, el);
          else rowRefs.delete(item.id);
        }}
        item={item}
        onPress={handleAnalyze}
        disabled={isRowInteractionDisabled}
        isActiveRow={item.id === checkingItemId}
        spinRotate={spinRotate}
      />
    ),
    [handleAnalyze, rowRefs, checkingItemId, isRowInteractionDisabled, spinRotate],
  );

  const keyExtractor = useCallback((item: SongSearchItem) => item.id, []);
  // The full-screen "가사를 분석하는 중..." graphic is reserved for an actual
  // new analysis request. Plain search loading keeps the search UI visible.
  const showFullScreenLoading = isAnalyzingNewSong;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.searchRow, showFullScreenLoading && styles.hidden]}>
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

      {!showFullScreenLoading && status === 'success' && items.length > 0 && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultLabel}>검색 결과</Text>
          <Text style={styles.resultCount}>{items.length}곡</Text>
        </View>
      )}

      {showFullScreenLoading ? (
        <AnalyzingView
          slot={
            analyzingItem ? (
              <Animated.View
                ref={animatedRowRef}
                onLayout={handleAnalyzingRowLayout}
                style={[
                  styles.analyzingRow,
                  {
                    transform: [{ translateY: rowAnim }],
                    opacity: rowMorphReady ? 1 : 0,
                  },
                ]}
              >
                <ArtworkImage url={analyzingItem.thumbnail} size={48} cornerRadius={8} />
                <View style={styles.analyzingContent}>
                  <Text style={styles.analyzingTitle} numberOfLines={1}>
                    {analyzingItem.title}
                  </Text>
                  <Text style={styles.analyzingSubtitle} numberOfLines={1}>
                    {analyzingItem.artistName} · {formatDuration(analyzingItem.durationSeconds)}
                  </Text>
                </View>
                <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
                  <Feather name="loader" size={18} color={Colors.primary} />
                </Animated.View>
              </Animated.View>
            ) : null
          }
        />
      ) : status === 'loading' ? (
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
            <Text style={styles.attribution}>Music search powered by iTunes</Text>
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
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: Dimens.screenPadding,
    alignSelf: 'stretch',
  },
  analyzingContent: {
    flex: 1,
  },
  analyzingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  analyzingSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
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
  hidden: { display: 'none' },
});
