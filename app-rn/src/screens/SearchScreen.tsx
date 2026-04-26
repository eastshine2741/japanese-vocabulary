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
import { Ionicons, Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { useSearchStore } from '../stores/searchStore';
import { usePlayerStore } from '../stores/playerStore';
import SongListItem from '../components/SongListItem';
import ErrorDialog from '../components/ErrorDialog';
import { Colors, Dimens } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getErrorMessage } from '../utils/errorMessages';
import { SongSearchItem } from '../types/song';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [analyzingItem, setAnalyzingItem] = useState<SongSearchItem | null>(null);
  const [rowMorphReady, setRowMorphReady] = useState(false);
  const insets = useSafeAreaInsets();
  const { searchStatus, items, search } = useSearchStore(
    useShallow(s => ({
      searchStatus: s.searchStatus,
      items: s.items,
      search: s.search,
    })),
  );
  const playerStatus = usePlayerStore(s => s.status);
  const analyze = usePlayerStore(s => s.analyze);

  const analyzing = playerStatus === 'loading';

  const rowAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const rowRefs = useRef<Map<string, View>>(new Map()).current;
  const fromYRef = useRef<number>(0);
  const animatedRowRef = useRef<View>(null);

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

  const handleSearch = () => {
    if (query.trim()) search(query.trim());
  };

  const spinRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.searchRow, analyzing && styles.hidden]}>
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

      {!analyzing && items.length > 0 && (
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
            searchStatus === 'loading' ? (
              <ActivityIndicator style={styles.loader} color={Colors.primary} />
            ) : null
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
