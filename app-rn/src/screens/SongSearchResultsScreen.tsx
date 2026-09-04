import React, { useState, useCallback, useEffect, useRef } from 'react';
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
} from 'react-native';
import ArtworkImage from '../components/ArtworkImage';
import ErrorDialog from '../components/ErrorDialog';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../stores/playerStore';
import { useSearchHistoryStore } from '../stores/searchHistoryStore';
import { songApi } from '../api/songApi';
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
}

const SearchResultRow = React.memo(React.forwardRef<View, SearchResultRowProps>(
  function SearchResultRow({ item, onPress }, ref) {
    const handlePress = useCallback(() => {
      onPress(item);
    }, [item, onPress]);

    return (
      <View ref={ref} collapsable={false}>
        <TouchableOpacity style={styles.resultRow} onPress={handlePress} activeOpacity={0.72}>
          <ArtworkImage url={item.thumbnail} size={48} cornerRadius={8} />
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.resultSubtitle} numberOfLines={1}>
              {item.artistName} · {formatDuration(item.durationSeconds)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  },
));

function ResultSeparator() {
  return <View style={styles.resultGap} />;
}

interface SearchAnalyzingStateProps {
  item: SongSearchItem | null;
  rowAnim: Animated.Value;
  rowMorphReady: boolean;
  spinRotate: Animated.AnimatedInterpolation<string | number>;
  animatedRowRef: React.RefObject<View | null>;
  onRowLayout: () => void;
}

function SearchAnalyzingState({
  item,
  rowAnim,
  rowMorphReady,
  spinRotate,
  animatedRowRef,
  onRowLayout,
}: SearchAnalyzingStateProps) {
  return (
    <View style={styles.loadingBody}>
      <View style={styles.loadingCenter}>
        {item ? (
          <Animated.View
            ref={animatedRowRef}
            onLayout={onRowLayout}
            style={[
              styles.selectedAnalyzingRow,
              {
                transform: [{ translateY: rowAnim }],
                opacity: rowMorphReady ? 1 : 0,
              },
            ]}
          >
            <ArtworkImage url={item.thumbnail} size={52} cornerRadius={12} />
            <View style={styles.selectedAnalyzingInfo}>
              <Text style={styles.resultTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.resultSubtitle} numberOfLines={1}>
                {item.artistName} · {formatDuration(item.durationSeconds)}
              </Text>
            </View>
            <Animated.View style={{ transform: [{ rotate: spinRotate }] }}>
              <Feather name="loader" size={18} color={Colors.primary} />
            </Animated.View>
          </Animated.View>
        ) : null}

        <View style={styles.loadingHero}>
          <View style={styles.loadingRingOuter} />
          <View style={styles.loadingRingMiddle} />
          <View style={styles.loadingRingInner} />
          <View style={styles.loadingCore}>
            <Feather name="music" size={32} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.loadingTextBlock}>
          <Text style={styles.loadingTitle}>가사를 분석하는 중...</Text>
          <Text style={styles.loadingSubtitle}>
            꼼꼼하게 확인하고 있으니 조금만 기다려주세요
          </Text>
        </View>

        <View style={styles.loadingHint}>
          <Feather name="clock" size={14} color={Colors.textMuted} />
          <Text style={styles.loadingHintText}>보통 15~20초 정도 걸려요</Text>
        </View>
      </View>
    </View>
  );
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

  const analyze = usePlayerStore(s => s.analyze);
  const playerStatus = usePlayerStore(s => s.status);
  const resetPlayer = usePlayerStore(s => s.reset);
  const recordSearchLocally = useSearchHistoryStore(s => s.recordLocally);

  const analyzing = playerStatus === 'loading';

  const rowAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const rowRefs = useRef<Map<string, View>>(new Map()).current;
  const fromYRef = useRef<number>(0);
  const animatedRowRef = useRef<View>(null);

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
    if (!analyzing) return;
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
  }, [analyzing, spinAnim]);

  useEffect(() => {
    if (!analyzing) {
      setAnalyzingItem(null);
      setRowMorphReady(false);
    }
  }, [analyzing]);

  useEffect(() => {
    return () => {
      if (usePlayerStore.getState().status === 'loading') {
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
    Keyboard.dismiss();
    const start = (fromY: number) => {
      fromYRef.current = fromY;
      setRowMorphReady(false);
      setAnalyzingItem(item);
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
  }, [analyze, navigation, rowRefs]);

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

  const spinRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderResultItem = useCallback(
    ({ item }: { item: SongSearchItem }) => (
      <SearchResultRow
        ref={(el) => {
          if (el) rowRefs.set(item.id, el);
          else rowRefs.delete(item.id);
        }}
        item={item}
        onPress={handleAnalyze}
      />
    ),
    [handleAnalyze, rowRefs],
  );

  const keyExtractor = useCallback((item: SongSearchItem) => item.id, []);
  const showFullScreenLoading = analyzing || status === 'loading';

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
        <SearchAnalyzingState
          item={analyzingItem}
          rowAnim={rowAnim}
          rowMorphReady={rowMorphReady}
          spinRotate={spinRotate}
          animatedRowRef={animatedRowRef}
          onRowLayout={handleAnalyzingRowLayout}
        />
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
  loadingBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  selectedAnalyzingRow: {
    width: '100%',
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
  },
  selectedAnalyzingInfo: {
    flex: 1,
    gap: 2,
  },
  loadingHero: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRingOuter: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.primary + '12',
  },
  loadingRingMiddle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.primary + '24',
  },
  loadingRingInner: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + '38',
  },
  loadingCore: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTextBlock: {
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  loadingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  loadingHintText: {
    fontSize: 12,
    color: Colors.textMuted,
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
