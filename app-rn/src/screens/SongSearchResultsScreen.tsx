import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Easing,
  Keyboard,
} from 'react-native';
import AnalyzingView from '../components/AnalyzingView';
import ArtworkImage from '../components/ArtworkImage';
import SongListItem from '../components/SongListItem';
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
          navigation.navigate('Player', { origin: 'Home' });
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

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.searchRow, analyzing && styles.hidden]}>
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

      {!analyzing && status === 'success' && items.length > 0 && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultLabel}>검색 결과</Text>
          <Text style={styles.resultCount}>{items.length}곡</Text>
        </View>
      )}

      {analyzing ? (
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
        <ActivityIndicator style={styles.centerLoader} color={Colors.primary} />
      ) : status === 'error' ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>검색에 실패했어요. 다시 시도해주세요.</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>검색 결과가 없어요.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              ref={(el) => {
                if (el) rowRefs.set(item.id, el);
                else rowRefs.delete(item.id);
              }}
              collapsable={false}
            >
              <SongListItem
                artworkUrl={item.thumbnail}
                title={item.title}
                subtitle={`${item.artistName} · ${formatDuration(item.durationSeconds)}`}
                showChevron
                onPress={() => handleAnalyze(item)}
              />
            </View>
          )}
          ListFooterComponent={
            <Text style={styles.attribution}>Music search powered by iTunes</Text>
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
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
  centerLoader: {
    flex: 1,
  },
  messageBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  messageText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  attribution: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Dimens.screenPadding,
    gap: 12,
    alignSelf: 'stretch',
  },
  analyzingContent: { flex: 1 },
  analyzingTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  analyzingSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  hidden: { display: 'none' },
});
